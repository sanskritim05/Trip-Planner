# Trip Planner (Name TBD) - Features and Functionality

## App Overview

This app is an AI-powered trip planner that helps users plan trips based on their budget, interests, available time, and places they want to visit.

Users first choose their destination and add places they already want to visit. The app then recommends other attractions, which users can swipe right to add or left to skip. Once users finish selecting places, the app creates a day-by-day itinerary with estimated costs, travel routes, and activities.

During the trip, the app guides users from one location to the next. Users take a picture at each stop to mark it as completed. These pictures remain locked until the last day of the trip. One day after the trip ends, the app automatically turns them into a personalized digital scrapbook.

Goal: Make trip planning easier and more personalized while helping users create and save memories from their travels.

## 1. Planning the Trip

### 1.1 Initial Trip Setup

- Users enter their destination, number of days, budget, and preferred travel dates.
- The app asks users which places they already want to visit.
- Users can search for attractions, restaurants, landmarks, and activities and add them to a Must Visit List.
- If users have saved places in their travel bucket list, the app shows those places and asks whether they want to include them.
- The app gives priority to must-visit places when building the itinerary.

### 1.2 Personalized Recommendations (Swipe Feature)

- After users select their must visit places, the app recommends other locations based on their interests, budget, and available time.
- Recommendations appear as cards with pictures, descriptions, estimated costs, and suggested visit times.
- Users swipe right (Yes) to add a place to their trip or swipe left (No) to skip it.
- Places saved in the user's bucket list can also appear as recommendation cards.
- The app recommends places that are close to locations the user already selected.
- As users swipe, the app learns what they like and improves future recommendations.
- Users continue swiping until they are happy with the places they have selected.

### 1.3 AI Itinerary Generator

- Once users finish selecting places, the app creates a day-by-day travel schedule.
- The itinerary includes all must-visit places and accepted recommendations that can fit into the trip.
- For each day, the app shows where to go, when to go, how long to stay, and how to reach the next location.
- It groups nearby places together to reduce travel time.
- The app considers opening hours, weather, and expected crowds when planning the schedule.
- If users select too many places, the app lets them know and suggests removing optional activities or extending the trip.
- Users can review and change their itinerary before confirming it.

### 1.4 Best Time to Travel

- Users enter their destination and how many days they want to travel.
- If they are unsure when to go, the app recommends the best dates or months.
- Recommendations are based on weather, travel costs, seasonal activities, and expected crowds.
- Users can compare different dates to see which option works best for them.
- The app also considers any dates when the user is unavailable.

### 1.5 Cost Estimation and Budget Planning

- The app estimates the total cost of the trip, including transportation, living situation (hotel, Airbnb, etc), food, and activities.
- Users can set a maximum budget.
- The app recommends places and activities that fit within that budget.
- Users can see estimated costs for each day and the entire trip.
- If the trip costs more than expected, the app suggests cheaper alternatives.
- During the trip, users can enter their actual expenses to track how much they have spent.

## 2. Maps, Navigation, and Schedule Changes

### 2.1 Interactive Map

- All selected locations appear on an interactive map.
- Users can click on a location to see pictures, descriptions, and other useful information (like fun facts :P).
- The map shows the route users will follow each day.
- Users can explore nearby attractions and add them to their plans.
- Completed locations are marked on the map so users can see their progress.

### 2.2 Efficient Route Planning

- The app finds efficient routes between locations to reduce unnecessary travel.
- It groups nearby attractions together so users do not have to travel back and forth.
- It suggests whether users should walk, drive, or take public transportation.
- Users can compare transportation options based on travel time and cost.
- Routes automatically update when the itinerary changes.

### 2.3 Smart Schedule Assistant

- Users can change their plans at any time by adding, removing, or rearranging activities.
- The app automatically updates the schedule and routes based on these changes.
- If users spend longer than expected at a location, the app adjusts the remaining activities.
- If users miss an attraction, the app suggests another time to visit it.
- If a place is closed or the weather changes, the app recommends alternatives.
- The app tries to keep the updated schedule realistic based on the time remaining.

## 3. Personalized Travel Experiences

### 3.1 Personalized Recommendations

- The app recommends places based on the user's interests, budget, and previous trips.
- Users can choose interests such as nature, shopping, food, history, or entertainment.
- The app also considers dietary preferences when recommending restaurants.
- It suggests popular attractions as well as local hidden gems.
- Recommendations improve as users save, visit, or skip different locations.

### 3.2 Movie and TV Show Filming Locations

- Users can search for their favorite movies or TV shows to find iconic filming locations.
- The app shows the real-world location, address, pictures, and information about the scene filmed there.
- When available, users can compare pictures from the movie or show with the actual location.
- Users can add these locations to their Must-Visit List.
- The app can also create a trip focused on visiting filming locations from a specific movie or TV show.

### 3.3 Travel Bucket List

- Users can save places they want to visit in the future.
- These places are stored in a personal travel bucket list.
- When users plan a trip to a destination that has saved places, the app reminds them about those locations.
- Saved places appear as recommendation cards, allowing users to swipe right to include them.
- Users can mark bucket-list locations as visited after completing them.

### 3.4 Future Trip Recommendations

- The app suggests future travel destinations based on the user's interests and previous trips.
- It recommends places that offer experiences similar to locations the user enjoyed.
- Users can save these suggestions to their bucket list.
- This helps users discover new destinations for future trips.

## 4. Weather and Crowd Information

### 4.1 Weather Integration

- The app uses a weather API to show the forecast for each day of the trip.
- It considers the weather when creating the itinerary.
- If rain is expected, the app may recommend indoor activities or move outdoor activities to another day.
- Users can check the weather directly from their daily schedule.
- For trips planned far in advance, the app uses typical weather patterns until forecasts become available.

### 4.2 Crowd Prediction

- The app estimates how crowded popular attractions might be using available data.
- It suggests the best times to visit to avoid large crowds.
- Crowd estimates are considered when creating the daily schedule.
- Users can compare different visiting times to decide when they want to go.
- This helps reduce waiting time and makes the trip more enjoyable.

## 5. Photo Check-Ins and Travel Memories

### 5.1 Photo-Based Location Check-In

- Each location in the itinerary works like a task on a checklist.
- When users reach a location, they take and upload a picture.
- Uploading the picture marks that location as completed.
- Once the location is completed, the app shows the next destination.
- It provides directions and estimated travel time to the next stop.
- Users can see how many places they have completed and how many are left.
- This makes exploring feel more interactive because users complete their itinerary by capturing memories.

### 5.2 Travel Time Capsule

- Every picture uploaded during the trip is saved in a digital time capsule.
- The saved pictures remain locked throughout the trip.
- Users cannot view the full collection until the final day.
- On the last day, the time capsule unlocks and reveals all the pictures taken during the trip.
- Pictures are organized by the day and location where they were taken.
- Users can add captions or short notes to remember their experiences.
- The time capsule gives users something to look forward to at the end of their journey.

### 5.3 Automatic Digital Scrapbook

- One day after the trip ends, the app automatically creates a digital scrapbook using the pictures from the time capsule.
- The scrapbook organizes pictures by day and location.
- It includes the dates, places visited, and any captions or notes added by users.
- The app creates scrapbook pages with different photo layouts.
- Users can customize their scrapbook by rearranging pictures, changing layouts, or adding messages.
- The scrapbook can also include a map showing all the places visited.
- Users can download or share their completed scrapbook.
- Previous scrapbooks are saved in the user's profile so they can revisit their memories.

## 6. Group Trip Planning

### 6.1 Collaborative Planning and Voting

- Users can invite friends, family, and anyone to plan a trip together.
- Each person can suggest places they want to visit.
- Group members can vote on the attractions and activities they like.
- The app uses these votes to help decide which places to include.
- Everyone can view the same itinerary.
- When someone changes the schedule, the updated plan is shown to all group members.

### 6.2 Shared Travel Memories

- Group members can upload their own pictures at each destination.
- Pictures from everyone are added to a shared time capsule.
- The pictures remain locked until the final day of the trip.
- One day after the trip ends, the app creates a shared digital scrapbook.
- The scrapbook includes pictures from different group members, allowing everyone to remember the trip together.
