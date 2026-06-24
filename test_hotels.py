import asyncio
import json

from backend.models import HotelRequest
from backend.search_service import search_hotels


async def main():
    request = HotelRequest(
        location="Delhi",
        check_in_date="2026-07-01",
        check_out_date="2026-07-05"
    )

    hotels = await search_hotels(request)

    print("\nHOTELS RECEIVED:\n")
    print(json.dumps(hotels, indent=4))


if __name__ == "__main__":
    asyncio.run(main())