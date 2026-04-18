import os, sys, sqlite3
from dotenv import load_dotenv

load_dotenv('marketflow/backend/.env')

db_url = os.environ.get('TURSO_DATABASE_URL')
db_token = os.environ.get('TURSO_AUTH_TOKEN')

print('URL:', db_url)
print('Token exists:', bool(db_token))

# Try connecting using standard sqlite3 if it's local, or using turso logic
# Wait, for turso, the python libsql-client is usually used in app.py.
# Let's see how app.py connects.
