"""
backend/models/schemas.py
Pydantic data models for API request validation, response serialization, and OpenAPI Swagger documentation schemas.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

# Product Schemas
class ProductSchema(BaseModel):
    id: str = Field(description="Unique product identifier", example="p1")
    name: str = Field(description="Product display name", example="Apex Pro Wireless Noise-Cancelling Headphones")
    category: str = Field(description="Product category ('Electronics', 'Fashion', 'Groceries')", example="Electronics")
    price: float = Field(description="Price in INR", example=4999.0)
    description: str = Field(description="One-line product description")
    rating: float = Field(default=4.8, description="Average customer rating")
    reviews: int = Field(default=100, description="Total review count")
    icon: str = Field(default="📦", description="Emoji icon or image placeholder")

class ProductListResponse(BaseModel):
    products: List[ProductSchema]
    total: int

# Session Schemas
class SessionStartRequest(BaseModel):
    item_name: str = Field(
        default="Apex Pro Wireless Noise-Cancelling Headphones",
        description="Name of the item in the shopper's cart",
        example="Apex Pro Wireless Noise-Cancelling Headphones"
    )
    price: float = Field(
        default=4999.0,
        description="Price per item in INR",
        example=4999.0
    )
    quantity: int = Field(
        default=1,
        description="Quantity of item",
        example=1
    )

class SessionStartResponse(BaseModel):
    session_id: str = Field(description="Unique ID generated for this checkout session")
    message: str = Field(description="Status confirmation message")
    cart: Dict[str, Any] = Field(description="Summary of the cart context stored for this session")

# Chat Schemas
class ChatMessage(BaseModel):
    role: str = Field(description="Sender role: 'user', 'assistant', or 'system'")
    content: str = Field(description="Text message content")
    timestamp: str = Field(description="ISO timestamp of message creation")

class ChatRequest(BaseModel):
    session_id: str = Field(description="Unique session ID returned from /session/start")
    message: str = Field(description="Shopper's text input or objection", example="Is there any discount available?")

class ChatResponse(BaseModel):
    session_id: str = Field(description="Active session ID")
    reply: str = Field(description="Agent's natural language reply to the shopper")
    objection_type: Optional[str] = Field(default=None, description="Detected objection type (e.g. price, payment_method, generic)")
    resolution_offered: Optional[str] = Field(default=None, description="Action or offer presented to shopper")
    payment_link: Optional[str] = Field(default=None, description="Generated Razorpay Test Mode Payment Link URL if payment was agreed")
    discount_percent: Optional[int] = Field(default=None, description="Applied discount percentage if applicable")
    payment_method: Optional[str] = Field(default=None, description="Suggested payment method (e.g. EMI, UPI, COD)")

# Payment Link Schemas
class CreatePaymentLinkRequest(BaseModel):
    amount: float = Field(description="Payment amount in INR", example=4499.0)
    description: str = Field(description="Item or offer description for payment", example="Apex Pro Headphones - Checkout Rescue Offer")
    session_id: Optional[str] = Field(default=None, description="Associated session ID if available")

class CreatePaymentLinkResponse(BaseModel):
    status: str = Field(description="Status of payment link creation ('created' or 'mock_created')")
    payment_link_id: str = Field(description="Razorpay payment link ID")
    payment_url: str = Field(description="URL shopper opens to complete Test Mode payment")
    amount: float = Field(description="Total charge amount")
    description: str = Field(description="Payment line-item description")

# Outcome Schemas
class LogOutcomeRequest(BaseModel):
    session_id: str = Field(description="Session ID for the finished cart rescue attempt")
    objection_type: str = Field(description="Type of objection raised ('price', 'payment_method', 'trust/delivery', 'other')")
    resolution: str = Field(description="Resolution offered ('10% discount', 'EMI option', 'UPI option', 'None')")
    converted: bool = Field(description="Whether the rescue attempt resulted in a payment click/completion")
    recovered_amount: float = Field(description="Amount recovered if converted (0.0 if not converted)")

class OutcomeResponse(BaseModel):
    session_id: str
    objection_type: str
    resolution: str
    converted: bool
    recovered_amount: float
    timestamp: str

class OutcomesListResponse(BaseModel):
    outcomes: List[OutcomeResponse]
    total_count: int
    converted_count: int
    total_recovered_amount: float

# Health Schema
class HealthResponse(BaseModel):
    status: str = Field(example="healthy")
    database: Dict[str, Any] = Field(description="MongoDB connectivity details")
    timestamp: str
