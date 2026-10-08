import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'month-one-local-development-only')
DEBUG = os.getenv('DJANGO_DEBUG', 'false').lower() == 'true'
ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv('DJANGO_ALLOWED_HOSTS', '127.0.0.1,localhost').split(',')
    if host.strip()
]

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

# DATABASE_URL (e.g. a Render/Postgres connection string) takes over in
# production; local development falls back to a plain SQLite file. Guarded
# explicitly because an empty-but-present DATABASE_URL in .env would
# otherwise defeat dj_database_url's own `default=` fallback.
DATABASE_URL = os.getenv('DATABASE_URL', '').strip()
DATABASES = {
    'default': dj_database_url.parse(DATABASE_URL, conn_max_age=600)
    if DATABASE_URL
    else {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}
}

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.AllowAny'],
}

# Raised from Django's 2.5 MB default so a 20 MB PDF/TXT upload (matching the
# Express-side limit) can arrive as a single multipart request.
DATA_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024

BACKEND_URL = os.getenv('BACKEND_URL', 'http://127.0.0.1:5000').rstrip('/')
BACKEND_CALLBACK_SECRET = os.getenv('BACKEND_CALLBACK_SECRET', '')
AI_SERVICE_SECRET = os.getenv('AI_SERVICE_SECRET', '')
