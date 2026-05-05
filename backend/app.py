from flask import Flask
from flask_cors import CORS
from db.database import init_db
from routes.chat_routes import chat_bp
from services.rag_service import cleanup_old_embeddings

def create_app():
    app = Flask(__name__)
    CORS(app)
    init_db()
    cleanup_old_embeddings(days=30)
    app.register_blueprint(chat_bp, url_prefix="/api")
    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)