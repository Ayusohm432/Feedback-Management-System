# Kisan Help Website - Project Explanation for Exam

## 1. Project Title
**Kisan Help Website** (Farmers Help Portal)

## 2. Objective
To help illiterate or less-literate Indian farmers ask farming-related questions using **Voice (Speech)** and get answers in **Voice** in their local language (Hindi, English, Bhojpuri).

## 3. Technology Stack (Tools Used)
- **Backend**: Python Django (Handles logic and database).
- **Frontend**: HTML, CSS, JavaScript (User Interface).
- **Database**: SQLite (built-in with Django) to save queries.
- **ML/NLP**: scikit-learn (Naive Bayes algorithm).
- **Dataset**: `dataset.csv` with Question-Answer pairs.
- **Speech-to-Text**: JavaScript Web Speech API (Converts voice to text).

- **Text-to-Speech**: gTTS (Google Text-to-Speech) Python library (Converts answer text to audio).

## 4. How it Works (Workflow)
1. **Input**: Farmer selects language and speaks (e.g., "Mausam kaisa hai?").
2. **Processing**: 
   - Browser converts voice to text.
   - Sends text to Django Backend.
   - **ML Engine** (`ml_engine.py`) takes the text.
   - Converts text to numbers using **TF-IDF**.
   - **Naive Bayes Model** predicts the best answer from the database.
   - gTTS converts answer to Audio file (`.mp3`).
3. **Output**: Website displays text answer and automatically plays the audio.

## 5. Key Code Files
- **ml_engine.py**: Handles Model Training and Prediction.
- **views.py**: Main logic. Uses `ml_engine` to get answers.
- **models.py**: `TrainingData` stores the dataset.
- **home.html**: The front page with microphone handling code (JavaScript).

## 6. Future Scope
- Connect with real Weather API / Crop API.
- Add AI Chatbot (ChatGPT/Gemini) integration.
- Mobile App version.
