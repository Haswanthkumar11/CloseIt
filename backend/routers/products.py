"""
backend/routers/products.py
Product catalog endpoints. Exposes GET /products to fetch catalog items stored in MongoDB Atlas.
"""

from fastapi import APIRouter
from backend.models.schemas import ProductListResponse, ProductSchema
from backend.db.mongo import get_products_db

router = APIRouter(tags=["Products"])

@router.get(
    "/products",
    response_model=ProductListResponse,
    summary="Get Product Catalog",
    description="Returns all product catalog items fetched from MongoDB Atlas."
)
async def get_products_endpoint():
    docs = await get_products_db()
    products_list = [ProductSchema(**doc) for doc in docs]
    return ProductListResponse(
        products=products_list,
        total=len(products_list)
    )
