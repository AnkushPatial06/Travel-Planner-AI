"""
backend/database/seed.py
=========================
DEVELOPMENT / DEMO SEED DATA ONLY.
Run with: python -m backend.database.seed
Creates sample planners, destinations, packages, and reviews.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from dotenv import load_dotenv
load_dotenv()

from backend.database.connection import SessionLocal, engine, Base
from backend.database.models import (
    User, UserRole, PlannerProfile, VerificationStatus,
    Destination, PlannerDestination,
    TravelPackage, PackageItinerary, PackageStatus,
    Review,
)
from backend.auth.utils import hash_password


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # ── Skip if already seeded ───────────────────────────────────────────
        if db.query(Destination).count() > 0:
            print("✅ Seed data already exists — skipping.")
            return

        print("🌱 Seeding database...")

        # ── 10 Destinations ──────────────────────────────────────────────────
        destinations_data = [
            {"name": "Manali",    "state": "Himachal Pradesh", "best_time": "Oct–Jun", "budget": 15000,
             "desc": "A breathtaking hill station surrounded by snow-capped Himalayas, pine forests, and the Beas River.",
             "image": "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800"},
            {"name": "Shimla",    "state": "Himachal Pradesh", "best_time": "Mar–Jun", "budget": 12000,
             "desc": "The 'Queen of Hills' — a colonial-era town with toy trains, apple orchards, and snow-covered peaks.",
             "image": "https://images.unsplash.com/photo-1597074866923-dc0589150358?w=800"},
            {"name": "Kasol",     "state": "Himachal Pradesh", "best_time": "Oct–Jun", "budget": 8000,
             "desc": "A serene backpacker's paradise in the Parvati Valley, known for trekking trails and scenic camping.",
             "image": "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=800"},
            {"name": "Kashmir",   "state": "Jammu & Kashmir",  "best_time": "Apr–Oct", "budget": 20000,
             "desc": "Heaven on earth — Dal Lake houseboats, Gulmarg skiing, Pahalgam meadows, and saffron fields.",
             "image": "https://images.unsplash.com/photo-1566837945700-30057527ade0?w=800"},
            {"name": "Goa",       "state": "Goa",              "best_time": "Nov–Mar", "budget": 18000,
             "desc": "India's beach paradise with golden sands, Portuguese heritage, vibrant nightlife, and fresh seafood.",
             "image": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800"},
            {"name": "Jaipur",    "state": "Rajasthan",        "best_time": "Oct–Mar", "budget": 14000,
             "desc": "The Pink City — Amber Fort, Hawa Mahal, City Palace, and the royal Rajasthani culture.",
             "image": "https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800"},
            {"name": "Udaipur",   "state": "Rajasthan",        "best_time": "Sep–Mar", "budget": 16000,
             "desc": "The City of Lakes — romantic boat rides on Lake Pichola, grand palaces, and Rajasthani cuisine.",
             "image": "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800"},
            {"name": "Rishikesh", "state": "Uttarakhand",      "best_time": "Feb–Jun", "budget": 10000,
             "desc": "The Yoga Capital of the World on the Ganges banks, with white-water rafting and spiritual ashrams.",
             "image": "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800"},
            {"name": "Kerala",    "state": "Kerala",            "best_time": "Sep–Mar", "budget": 22000,
             "desc": "God's Own Country — backwater houseboats, Munnar tea gardens, Kovalam beaches, and Ayurveda.",
             "image": "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800"},
            {"name": "Ladakh",    "state": "Ladakh",            "best_time": "May–Sep", "budget": 25000,
             "desc": "A high-altitude desert landscape with Buddhist monasteries, Pangong Lake, and Zanskar Valley.",
             "image": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800"},
        ]

        dests = []
        for d in destinations_data:
            dest = Destination(
                name=d["name"], country="India", state=d["state"],
                description=d["desc"], image=d["image"],
                best_time_to_visit=d["best_time"], average_budget=d["budget"],
                attractions=[
                    f"{d['name']} viewpoints",
                    "Local markets",
                    "Cultural landmarks",
                    "Food walks",
                ],
                activities=[
                    "Guided sightseeing",
                    "Local cuisine tasting",
                    "Photography walks",
                    "Heritage exploration",
                ],
                travel_tips=[
                    f"Book stays early during {d['best_time']}.",
                    "Keep local transport buffers in the itinerary.",
                    "Carry a government ID for hotel check-ins and permits.",
                ],
                images=[d["image"]],
            )
            db.add(dest)
            dests.append(dest)
        db.flush()

        # ── 5 Planner Users ──────────────────────────────────────────────────
        planners_data = [
            {"name": "Arjun Sharma",   "email": "arjun@demo.com",   "loc": "Delhi",     "exp": 8,  "price": 5000,
             "bio": "Adventure travel specialist with 8 years exploring North India's mountains and valleys."},
            {"name": "Priya Nair",     "email": "priya@demo.com",   "loc": "Kochi",     "exp": 6,  "price": 4500,
             "bio": "Kerala-born expert in backwater tourism, Ayurveda retreats, and South India circuits."},
            {"name": "Rohit Kapoor",   "email": "rohit@demo.com",   "loc": "Jaipur",    "exp": 10, "price": 6000,
             "bio": "Rajasthan cultural specialist — royal heritage tours, desert safaris, and palace stays."},
            {"name": "Sneha Gupta",    "email": "sneha@demo.com",   "loc": "Goa",       "exp": 5,  "price": 4000,
             "bio": "Beach and party travel curator for Goa, Kerala beaches, and Andaman Islands."},
            {"name": "Vikram Thakur",  "email": "vikram@demo.com",  "loc": "Manali",    "exp": 12, "price": 7000,
             "bio": "12 years leading Himalayan treks — Spiti, Leh, Manali circuits and camping expeditions."},
        ]

        planner_users = []
        profiles = []
        for pd in planners_data:
            user = User(
                name=pd["name"], email=pd["email"], phone="+91 9876543210",
                password_hash=hash_password("Demo@1234"),
                role=UserRole.planner,
            )
            db.add(user)
            db.flush()

            profile = PlannerProfile(
                user_id=user.id, bio=pd["bio"], location=pd["loc"],
                years_experience=pd["exp"], starting_price=pd["price"],
                verification_status=VerificationStatus.verified,
                rating=4.5, total_reviews=10,
            )
            db.add(profile)
            db.flush()
            planner_users.append(user)
            profiles.append(profile)

        # ── Planner-Destination specialisations ──────────────────────────────
        specializations = [
            (0, [0, 1, 2, 3, 7, 9]),   # Arjun → mountain destinations
            (1, [4, 8]),                # Priya → Kerala, Goa
            (2, [5, 6]),                # Rohit → Rajasthan
            (3, [4, 8]),                # Sneha → beach destinations
            (4, [0, 1, 2, 3, 9]),      # Vikram → Himalayan destinations
        ]
        for pi, dest_idxs in specializations:
            for di in dest_idxs:
                db.add(PlannerDestination(
                    planner_id=profiles[pi].id,
                    destination_id=dests[di].id,
                ))

        # ── 10 Travel Packages ───────────────────────────────────────────────
        packages_data = [
            {"planner": 0, "dest": 0, "title": "Manali Adventure Circuit", "days": 6, "price": 28000,
             "style": "Adventure", "desc": "Rohtang Pass, Solang Valley, camping by Beas River, and local cuisine.",
             "itinerary": [
                 (1, "Arrival & Old Manali", "Check-in, explore Old Manali bazaar, Hadimba Temple.", ["Visit Hadimba Temple", "Explore Mall Road", "Old Manali cafes"]),
                 (2, "Solang Valley", "Snow activities, paragliding, zorbing.", ["Paragliding", "Zorbing", "Snow activities"]),
                 (3, "Rohtang Pass", "Day trip to Rohtang (permit required), glacier views.", ["Rohtang Pass visit", "Glacier photography"]),
                 (4, "Kullu Rafting", "White-water rafting on Beas, local markets.", ["River rafting", "Kullu market visit"]),
                 (5, "Manikaran Gurudwara", "Hot springs, spiritual experience, natural hot baths.", ["Gurudwara visit", "Hot springs"]),
                 (6, "Departure", "Breakfast and check-out.", ["Check-out"]),
             ]},
            {"planner": 1, "dest": 8, "title": "Kerala Backwater Bliss", "days": 7, "price": 35000,
             "style": "Leisure", "desc": "Houseboat stays in Alleppey, Munnar tea gardens, and Kovalam beach.",
             "itinerary": [
                 (1, "Arrive Kochi", "Fort Kochi exploration, Chinese fishing nets, spice market.", ["Chinese fishing nets", "Fort Kochi walk"]),
                 (2, "Munnar Tea Gardens", "Drive to Munnar, visit tea museum, Eravikulam National Park.", ["Tea plantation tour", "Tea tasting"]),
                 (3, "Thekkady", "Periyar wildlife sanctuary boat ride, spice plantation.", ["Wildlife boat safari", "Spice plantation"]),
                 (4, "Alleppey Houseboat", "Traditional houseboat day cruise through Kerala backwaters.", ["Houseboat cruise", "Village walks"]),
                 (5, "Kovalam Beach", "Drive to Kovalam, beach relaxation, Ayurveda massage.", ["Beach relaxation", "Ayurveda massage"]),
                 (6, "Trivandrum Sightseeing", "Padmanabhaswamy Temple, Napier Museum.", ["Temple visit", "Museum tour"]),
                 (7, "Departure", "Check-out and transfer to airport.", ["Check-out"]),
             ]},
            {"planner": 2, "dest": 5, "title": "Royal Rajasthan - Jaipur", "days": 4, "price": 22000,
             "style": "Cultural", "desc": "Amber Fort, City Palace, Hawa Mahal, and desert camel safari.",
             "itinerary": [
                 (1, "Arrival Jaipur", "Check-in, City Palace, Jantar Mantar observatory.", ["City Palace", "Jantar Mantar"]),
                 (2, "Amber Fort", "Amber Fort elephant ride, Nahargarh Fort sunset views.", ["Amber Fort", "Nahargarh Fort"]),
                 (3, "Hawa Mahal & Markets", "Hawa Mahal photography, Johri Bazaar shopping.", ["Hawa Mahal", "Johri Bazaar shopping"]),
                 (4, "Departure", "Chokhi Dhani cultural village dinner, departure.", ["Chokhi Dhani"]),
             ]},
            {"planner": 3, "dest": 4, "title": "Goa Beach Party Package", "days": 5, "price": 24000,
             "style": "Beach", "desc": "North Goa parties, South Goa relaxation, water sports, and Portuguese heritage.",
             "itinerary": [
                 (1, "Arrive Goa", "Check-in, Calangute Beach, sunset at Baga.", ["Calangute Beach", "Baga sunset"]),
                 (2, "North Goa Tour", "Anjuna flea market, Chapora Fort, Vagator Beach.", ["Anjuna market", "Chapora Fort"]),
                 (3, "Water Sports Day", "Jet skiing, parasailing, banana boat, dolphin spotting.", ["Jet skiing", "Parasailing", "Dolphin spotting"]),
                 (4, "South Goa", "Palolem Beach, Old Goa churches, spice plantation.", ["Palolem Beach", "Old Goa churches"]),
                 (5, "Departure", "Morning beach walk, check-out.", ["Beach walk", "Check-out"]),
             ]},
            {"planner": 4, "dest": 9, "title": "Ladakh Himalayan Odyssey", "days": 8, "price": 45000,
             "style": "Adventure", "desc": "Pangong Lake, Nubra Valley, Khardung La Pass, and Buddhist monasteries.",
             "itinerary": [
                 (1, "Arrive Leh", "Acclimatisation day, Leh Palace, Shanti Stupa.", ["Leh Palace", "Shanti Stupa"]),
                 (2, "Leh Local", "Thiksey Monastery, Shey Palace, Rancho school.", ["Thiksey Monastery", "Shey Palace"]),
                 (3, "Khardung La Pass", "World's highest motorable road, Nubra Valley.", ["Khardung La pass", "Nubra Valley entry"]),
                 (4, "Nubra Valley", "Bactrian camel safari at Hunder Sand Dunes.", ["Camel safari", "Diskit Monastery"]),
                 (5, "Pangong Lake", "Drive via Shyok Valley, overnight at Pangong Lake.", ["Pangong Lake arrival", "Lakeside camping"]),
                 (6, "Pangong to Leh", "Sunrise at Pangong, drive back via Chang La Pass.", ["Sunrise photography", "Chang La Pass"]),
                 (7, "Magnetic Hill & Gurudwara", "Magnetic Hill, Pathar Sahib Gurudwara, river confluence.", ["Magnetic Hill", "Sangam view"]),
                 (8, "Departure", "Morning market, check-out, airport transfer.", ["Leh market", "Check-out"]),
             ]},
        ]

        created_packages = []
        for pd in packages_data:
            pkg = TravelPackage(
                planner_id=profiles[pd["planner"]].id,
                destination_id=dests[pd["dest"]].id,
                title=pd["title"],
                description=pd["desc"],
                duration_days=pd["days"],
                price=pd["price"],
                max_travelers=12,
                travel_style=pd["style"],
                status=PackageStatus.active,
                hotels=["Verified 3-star or boutique stays", "Upgrade options available"],
                activities=["Daily guided experiences", "Local food and culture stops"],
                images=[dests[pd["dest"]].image],
                inclusions=["Accommodation", "Local transfers", "Planner support", "Listed activities"],
                exclusions=["Flights", "Personal expenses", "Travel insurance"],
                availability={"note": "Available on request with seasonal date confirmation"},
            )
            db.add(pkg)
            db.flush()

            for day_num, title, desc, activities in pd["itinerary"]:
                db.add(PackageItinerary(
                    package_id=pkg.id, day_number=day_num,
                    title=title, description=desc, activities=activities,
                ))
            created_packages.append(pkg)

        # ── 1 sample traveller ───────────────────────────────────────────────
        traveler = User(
            name="Test Traveler", email="traveler@demo.com",
            phone="+91 9000000001",
            password_hash=hash_password("Demo@1234"),
            role=UserRole.traveler,
        )
        db.add(traveler)
        db.flush()

        # ── Sample reviews ───────────────────────────────────────────────────
        for i, (pkg, planner_user) in enumerate(zip(created_packages[:3], planner_users[:3])):
            db.add(Review(
                traveler_id=traveler.id,
                planner_id=planner_user.id,
                package_id=pkg.id,
                rating=5 - (i % 2),
                review_text=[
                    "Absolutely fantastic experience! Arjun's knowledge of Manali was incredible.",
                    "Priya arranged the most beautiful houseboat stay. Kerala was magical!",
                    "Rohit made Jaipur come alive with his stories. Highly recommend!",
                ][i],
            ))

        db.commit()
        print("✅ Seed data inserted successfully!")
        print(f"   • {len(dests)} destinations")
        print(f"   • {len(planner_users)} planner accounts (password: Demo@1234)")
        print(f"   • {len(created_packages)} travel packages")
        print("   • 1 test traveler account: traveler@demo.com (password: Demo@1234)")

    except Exception as e:
        db.rollback()
        print(f"❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
