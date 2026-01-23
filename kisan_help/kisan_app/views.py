from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import FarmerQuery
import os
from django.conf import settings
from gtts import gTTS
import uuid
from .ml_engine import predict_answer

def home(request):
    return render(request, 'home.html')

def get_answer(query, lang):
    query = query.lower()
    
    # Simple Mock Knowledge Base
    responses = {
        'en': {
            'crop': "You can grow Wheat, Rice, and Maize.",
            'fertilizer': "Use NPK fertilizer for better growth.",
            'weather': "It is sunny today. Good for harvesting.",
            'default': "I did not understand. Ask about crop, fertilizer, weather."
        },
        'hi': {
            'crop': "आप गेहूँ, चावल और मक्का उगा सकते हैं।",
            'fertilizer': "बेहतर विकास के लिए NPK खाद का उपयोग करें।",
            'weather': "आज धूप खिली है। कटाई के लिए अच्छा है।",
            'default': "मुझे समझ नहीं आया। फसल, खाद या मौसम के बारे में पूछें।"
        },
        'bho': { # Bhojpuri (using Hindi script roughly)
            'crop': "रउआ गेहूं, चावल अउरी मक्का लगा सकत बानी।",
            'fertilizer': "बढ़िया उपज खातिर NPK खाद डालीं।",
            'weather': "आज घाम निकलल बा। कटनी खातिर बढ़िया बा।",
            'default': "हमरा समझ में ना आइल. फसल, खाद या मौसम के बारे में पूछीं."
        }
    }
    
    # Detect intent (very simple keyword matching)
    key = 'default'
    if 'crop' in query or 'फसल' in query:
        key = 'crop'
    elif 'fertilizer' in query or 'khad' in query or 'खाद' in query:
        key = 'fertilizer'
    elif 'weather' in query or 'mausam' in query or 'मौसम' in query:
        key = 'weather'
        
    return responses.get(lang, responses['en'])[key]

@csrf_exempt
def process_query(request):
    if request.method == 'POST':
        query_text = request.POST.get('query')
        lang = request.POST.get('language', 'en') # 'hi', 'en', 'bho'
        
        if not query_text:
            return JsonResponse({'error': 'No query provided'})

        # ML Logic
        answer_text = predict_answer(query_text)
        
        # Save to DB
        FarmerQuery.objects.create(query_text=query_text, language=lang, answer_text=answer_text)
        
        # TTS Logic
        # Bhojpuri not supported in gTTS, use Hindi 'hi'
        tts_lang = 'hi' if lang == 'bho' else lang
        
        try:
            tts = gTTS(text=answer_text, lang=tts_lang, slow=False)
            filename = f"audio_{uuid.uuid4()}.mp3"
            filepath = os.path.join(settings.MEDIA_ROOT, filename)
            tts.save(filepath)
            audio_url = settings.MEDIA_URL + filename
        except Exception as e:
            print(f"TTS Error: {e}")
            audio_url = None # Handle error gracefully on frontend if no audio

        return JsonResponse({'answer': answer_text, 'audio_url': audio_url})
    
    return JsonResponse({'error': 'Invalid request'}, status=400)
