import csv
from django.core.management.base import BaseCommand
from kisan_app.models import TrainingData
from kisan_app.ml_engine import train_model

class Command(BaseCommand):
    help = 'Load training data from CSV and train the model'

    def handle(self, *args, **kwargs):
        file_path = 'dataset.csv'
        
        self.stdout.write("Loading data...")
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                TrainingData.objects.get_or_create(
                    question=row['question'],
                    defaults={
                        'answer': row['answer'],
                        'language': row['language'],
                        'category': row['category']
                    }
                )
                count += 1
        
        self.stdout.write(f"Loaded {count} records.")
        
        self.stdout.write("Training model...")
        result = train_model()
        self.stdout.write(self.style.SUCCESS(f"Success! {result}"))
