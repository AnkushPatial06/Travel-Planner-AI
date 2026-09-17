# ✈️ Travel Planner AI

An AI-powered full-stack travel planning platform that helps users discover destinations, search flights and hotels, check weather conditions, estimate trip budgets, and generate personalized travel itineraries.

The project combines a modern web frontend with a FastAPI backend, AI-powered travel planning, external travel APIs, authentication, database support, and deployment-ready configuration.

---

## 🌍 Project Overview

Travel Planner AI is designed to simplify the complete travel-planning process in one platform.

Instead of searching for flights, hotels, weather information, budgets, and itineraries separately, users can provide their travel requirements and get relevant travel information through a single application.

The platform supports:

- User registration and authentication
- Destination exploration
- Flight search
- Hotel search
- Weather information
- Trip budget estimation
- AI-powered travel analysis
- Personalized itinerary generation
- Trip planning
- Responsive web interface
- Backend APIs
- Database integration

---

## ✨ Key Features

### 🔐 User Authentication

Users can create an account and securely sign in to the platform.

Features include:

- User registration
- User login
- Authentication
- JWT-based authentication
- Protected user functionality
- Secure environment-based configuration

---

### ✈️ Flight Search

Users can search for available flights by providing:

- Origin
- Destination
- Travel date
- Number of travelers
- Budget/preferences

Flight information is retrieved through external travel search APIs.

---

### 🏨 Hotel Search

The platform allows users to search for accommodation based on their destination and travel requirements.

Users can explore:

- Hotels
- Pricing information
- Ratings
- Locations
- Available accommodation options

---

### 🌤️ Weather Information

Users can check weather information for their selected destination.

Weather data can be used while planning the trip to make better travel decisions.

The application integrates weather information through an external weather API.

---

### 💰 Travel Budget Estimation

The application provides travel budget analysis based on factors such as:

- Flights
- Accommodation
- Food
- Local transportation
- Activities
- Other estimated expenses

The system helps users understand the expected cost of their trip.

---

### 🤖 AI-Powered Travel Planning

The core feature of the application is AI-assisted travel planning.

The system can analyze:

- Destination
- Travel duration
- Budget
- User preferences
- Travel requirements
- Available travel information

and generate personalized travel recommendations and itineraries.

---

### 🗓️ Personalized Itinerary

The application can generate a structured trip itinerary containing:

- Day-wise travel plans
- Places to visit
- Activities
- Travel suggestions
- Budget considerations
- Destination recommendations

This helps users organize their complete trip.

---

### 📊 Travel Analysis

The platform provides additional travel analysis including:

- Budget analysis
- Weather information
- Travel information
- Destination insights
- AI-generated recommendations

---

## 🏗️ System Architecture

```text
                    ┌─────────────────────┐
                    │      User           │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Frontend            │
                    │ HTML / CSS / JS     │
                    └──────────┬──────────┘
                               │
                         REST API Requests
                               │
                               ▼
                    ┌─────────────────────┐
                    │ FastAPI Backend     │
                    │ Python              │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
       ┌────────────┐   ┌────────────┐   ┌────────────┐
       │ AI Service │   │ Search API │   │ Weather API│
       └────────────┘   └────────────┘   └────────────┘
              │
              ▼
       ┌────────────────┐
       │ Travel Planning│
       │ & Itinerary    │
       └────────────────┘
              │
              ▼
       ┌────────────────┐
       │ Database       │
       │ MySQL          │
       └────────────────┘
