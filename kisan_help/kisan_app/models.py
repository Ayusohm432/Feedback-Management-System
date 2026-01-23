from django.db import models

class FarmerQuery(models.Model):
    LANGUAGE_CHOICES = [
        ('hi', 'Hindi'),
        ('en', 'English'),
        ('bho', 'Bhojpuri'),
    ]

    query_text = models.TextField()
    language = models.CharField(max_length=10, choices=LANGUAGE_CHOICES)
    answer_text = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.language}: {self.query_text[:50]}"

class TrainingData(models.Model):
    CATEGORY_CHOICES = [
        ('crop', 'Crop Info'),
        ('fertilizer', 'Fertilizer'),
        ('weather', 'Weather'),
        ('disease', 'Disease'),
        ('irrigation', 'Irrigation'),
        ('other', 'Other'),
    ]

    question = models.TextField()
    answer = models.TextField()
    language = models.CharField(max_length=10, default='en')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other')

    def __str__(self):
        return f"[{self.language}] {self.question[:50]}"

