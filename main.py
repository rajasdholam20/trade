# main.py
from fastapi import FastAPI, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timedelta
import jwt
import bcrypt
import motor.motor_asyncio
import asyncio
import json
import random
from contextlib import asynccontextmanager
from fastapi.security import HTTPAuthorizationCredentials
import pandas as pd
from pathlib import Path

# --- Configuration ---
SECRET_KEY = "a_very_secret_key_for_your_project"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
MONGODB_URL = "mongodb://localhost:27017"
DATABASE_NAME = "darker_trade_db"

# --- Data Loading and Preparation ---

def load_all_stock_data(data_directory: Path) -> pd.DataFrame:
    """
    Loads all .xlsx files from a directory, combines them,
    and adds a 'Stock' column based on the filename.
    """
    all_files = list(data_directory.glob("*_historical.xlsx"))
    if not all_files:
        print(f"Warning: No historical data files found in '{data_directory}'.")
        return pd.DataFrame()

    df_list = []
    for file_path in all_files:
        ticker = file_path.name.split('_')[0].upper()
        try:
            df = pd.read_excel(file_path)
            df['Stock'] = ticker
            # Ensure essential columns exist
            required_cols = ['timestamp', 'open', 'high', 'low', 'close']
            if not all(col in df.columns for col in required_cols):
                 print(f"Warning: Skipping {file_path.name} due to missing columns.")
                 continue
            df_list.append(df)
            print(f"Loaded {file_path.name} for ticker {ticker}")
        except Exception as e:
            print(f"Error loading {file_path.name}: {e}")

    if not df_list:
        return pd.DataFrame()
        
    combined_df = pd.concat(df_list, ignore_index=True)
    combined_df['timestamp'] = pd.to_datetime(combined_df['timestamp'])
    combined_df.set_index('timestamp', inplace=True)
    return combined_df

# --- Database Setup ---
client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
db = client[DATABASE_NAME]
users_collection = db.users
trades_collection = db.trades
watchlists_collection = db.watchlists

# --- WebSocket Connection Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

# --- Mock Data & Price Simulation (ENHANCED FOR FRONTEND) ---
MOCK_STOCKS = {
    "AAPL":  {"name": "Apple Inc.", "price": 185.00, "last_price": 185.00, "day_high": 186.50, "day_low": 184.20},
    "GOOGL": {"name": "Alphabet Inc.", "price": 140.00, "last_price": 140.00, "day_high": 141.00, "day_low": 139.50},
    "MSFT":  {"name": "Microsoft", "price": 380.00, "last_price": 380.00, "day_high": 382.10, "day_low": 378.90},
    "TSLA":  {"name": "Tesla, Inc.", "price": 250.00, "last_price": 250.00, "day_high": 255.00, "day_low": 248.50},
    "WMT":   {"name": "Walmart", "price": 160.00, "last_price": 160.00, "day_high": 160.80, "day_low": 159.20},
    "IBM":   {"name": "IBM", "price": 145.00, "last_price": 145.00, "day_high": 145.90, "day_low": 144.10},
}

async def simulate_price_changes():
    """Simulates real-time stock price changes and broadcasts them via WebSocket."""
    while True:
        await asyncio.sleep(2) # Update interval
        for ticker, data in MOCK_STOCKS.items():
            change_percent = random.uniform(-0.015, 0.015)
            new_price = data["price"] * (1 + change_percent)
            
            # Update data
            MOCK_STOCKS[ticker]["price"] = round(new_price, 2)
            MOCK_STOCKS[ticker]["day_high"] = round(max(data["day_high"], new_price), 2)
            MOCK_STOCKS[ticker]["day_low"] = round(min(data["day_low"], new_price), 2)
            
            change = ((new_price - data['last_price']) / data['last_price']) * 100
            
            # Message for frontend
            update_message = {
                "ticker": ticker,
                "price": MOCK_STOCKS[ticker]["price"],
                "change": round(change, 2),
                "high": MOCK_STOCKS[ticker]["day_high"],
                "low": MOCK_STOCKS[ticker]["day_low"]
            }
            await manager.broadcast(json.dumps(update_message))
        
        # Update last_price after broadcasting
        for ticker, data in MOCK_STOCKS.items():
             MOCK_STOCKS[ticker]["last_price"] = data["price"]

# --- Lifespan Context Manager ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles application startup and shutdown events."""
    print("Application startup: Starting background tasks...")
    # Load data into memory when the server starts
    app.state.historical_data = load_all_stock_data(Path("./data"))
    task = asyncio.create_task(simulate_price_changes())
    yield
    print("Application shutdown: Cleaning up...")
    task.cancel()

# --- FastAPI App Initialization ---
app = FastAPI(
    title="TradingOne API",
    description="API for the TradingOne smart trading terminal.",
    version="1.0.0",
    lifespan=lifespan
)

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows all origins, crucial for local dev
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods
    allow_headers=["*"], # Allows all headers
)

# --- Pydantic Data Models ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class Token(BaseModel):
    access_token: str
    token_type: str

class Trade(BaseModel):
    symbol: str
    quantity: int
    side: str # 'buy' or 'sell'

class NewsItem(BaseModel):
    title: str
    source: str
    date: str
    snippet: str

# --- Security and Authentication ---
security = HTTPBearer()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")
        user = await users_collection.find_one({"email": email})
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")

# --- API Endpoints ---

@app.get("/")
def read_root():
    return {"message": "TradingOne API is running."}

# --- Authentication Endpoints ---
@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate):
    if await users_collection.find_one({"email": user.email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt())
    
    new_user = {
        "email": user.email,
        "full_name": user.full_name,
        "hashed_password": hashed_password,
        # Generate a consistent avatar URL based on the user's name
        "photo_url": f"https://api.dicebear.com/7.x/initials/svg?seed={user.full_name.replace(' ', '')}",
        "created_at": datetime.utcnow()
    }
    await users_collection.insert_one(new_user)
    
    # Create a default watchlist for the new user
    await watchlists_collection.insert_one({
        "user_email": user.email,
        "My Watchlist": [{"ticker": "AAPL", "name": "Apple Inc."}, {"ticker": "MSFT", "name": "Microsoft"}]
    })

    return {"message": "User created successfully. Please login."}

@app.post("/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await users_collection.find_one({"email": form_data.username})
    if not user or not bcrypt.checkpw(form_data.password.encode('utf-8'), user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user["email"]})
    return {"access_token": access_token, "token_type": "bearer"}

# --- User and Data Endpoints ---
@app.get("/user/profile")
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    # Return a stripped-down, frontend-friendly version of the user document
    return {
        "fullName": current_user.get("full_name"),
        "email": current_user.get("email"),
        "photoUrl": current_user.get("photo_url"),
        "createdAt": current_user.get("created_at")
    }

@app.get("/watchlists")
async def get_watchlists(current_user: dict = Depends(get_current_user)):
    user_watchlists = await watchlists_collection.find_one({"user_email": current_user["email"]})
    if not user_watchlists:
        return {} # Return empty object if no watchlists exist
    
    response = {}
    for name, stocks in user_watchlists.items():
        if name in ["_id", "user_email"]:
            continue
        
        stock_details = []
        for stock in stocks:
            ticker = stock["ticker"]
            # Get live data, with defaults if not found
            live_data = MOCK_STOCKS.get(ticker, {"price": 0, "last_price": 0, "day_high": 0, "day_low": 0})
            change = ((live_data["price"] - live_data["last_price"]) / live_data["last_price"] * 100) if live_data["last_price"] > 0 else 0
            
            stock_details.append({
                "ticker": ticker,
                "name": stock["name"],
                "price": live_data["price"],
                "change": round(change, 2),
                "high": live_data["day_high"],
                "low": live_data["day_low"]
            })
        response[name] = stock_details
    return response

@app.get("/trades")
async def get_trade_history(current_user: dict = Depends(get_current_user)):
    """Retrieves the trade history (orders) for the current user."""
    trades = []
    cursor = trades_collection.find({"user_email": current_user["email"]}).sort("timestamp", -1)
    async for trade in cursor:
        trade["id"] = str(trade["_id"])
        # Ensure it's JSON serializable
        trade.pop("_id") 
        trades.append(trade)
    return trades

@app.post("/trades", status_code=status.HTTP_201_CREATED)
async def execute_trade(trade: Trade, current_user: dict = Depends(get_current_user)):
    if trade.symbol not in MOCK_STOCKS:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    trade_doc = {
        "user_email": current_user["email"],
        "symbol": trade.symbol,
        "quantity": trade.quantity,
        "side": trade.side,
        "price": MOCK_STOCKS[trade.symbol]["price"],
        "status": "Executed", # Frontend expects a status
        "timestamp": datetime.utcnow()
    }
    await trades_collection.insert_one(trade_doc)
    return {"message": f"Order to {trade.side} {trade.quantity} share(s) of {trade.symbol} was successful."}

# --- NEW Endpoint for Financial News ---
@app.get("/news", response_model=List[NewsItem])
async def get_financial_news():
    """Provides a mock list of financial news articles for the dashboard."""
    return [
        {"title": "Market Hits All-Time High Amid Tech Rally", "source": "MarketWatch", "date": "2025-08-06", "snippet": "Tech giants lead the charge as the S&P 500 and Nasdaq reach new peaks..."},
        {"title": "Federal Reserve Hints at Tapering Sooner Than Expected", "source": "Bloomberg", "date": "2025-08-06", "snippet": "Minutes from the latest FOMC meeting suggest a shift in monetary policy may be imminent..."},
        {"title": "Oil Prices Surge on Supply Concerns", "source": "Reuters", "date": "2025-08-05", "snippet": "Geopolitical tensions and lower-than-expected inventory reports drive crude oil prices up..."},
        {"title": "Electric Vehicle Sector Sees Major Investment Influx", "source": "TechCrunch", "date": "2025-08-05", "snippet": "Legacy automakers and startups alike are pouring billions into EV development..."},
        {"title": "Cryptocurrency Regulation Debates Intensify in Washington", "source": "CoinDesk", "date": "2025-08-04", "snippet": "Lawmakers are considering new frameworks to govern the rapidly growing digital asset space..."}
    ]

# --- Main Charting Endpoint ---
@app.get("/charts/historical/{ticker}")
def get_historical_chart_data(ticker: str):
    """Provides historical data for a given stock ticker formatted for charts."""
    historical_data = app.state.historical_data
    if historical_data.empty:
        raise HTTPException(status_code=404, detail="Historical data not loaded.")

    stock_data = historical_data[historical_data['Stock'] == ticker.upper()]
    if stock_data.empty:
        raise HTTPException(status_code=404, detail=f"No data found for ticker {ticker}")

    # Format data into [timestamp, [open, high, low, close]] structure
    # The timestamp needs to be in milliseconds for JavaScript charts.
    chart_series = []
    for timestamp, row in stock_data.iterrows():
        chart_series.append({
            "x": int(timestamp.timestamp() * 1000), # Convert to JS timestamp (milliseconds)
            "y": [row['open'], row['high'], row['low'], row['close']]
        })
    return chart_series

# --- WebSocket Endpoint ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """The WebSocket endpoint for broadcasting real-time price updates."""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection open to listen for potential messages from client
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)