import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'month-one-local-development-only')
DEBUG = os.getenv('DJANGO_DEBUG', 'false').lower() == 'true'
ALLOWED_HOSTS = ['127.0.0.1', 'localhost']

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'rest_framework',
    'knowledge',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'campus_ai.urls'
TEMPLATES = []
WSGI_APPLICATION = 'campus_ai.wsgi.application'
ASGI_APPLICATION = 'campus_ai.asgi.application'
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.AllowAny'],
}

BACKEND_URL = os.getenv('BACKEND_URL', 'http://127.0.0.1:5000').rstrip('/')
BACKEND_CALLBACK_SECRET = os.getenv('BACKEND_CALLBACK_SECRET', '')
AI_SERVICE_SECRET = os.getenv('AI_SERVICE_SECRET', '')
BACKEND_UPLOADS_DIR = Path(
    os.getenv('BACKEND_UPLOADS_DIR', str(BASE_DIR.parent / 'backend' / 'uploads'))
).resolve()