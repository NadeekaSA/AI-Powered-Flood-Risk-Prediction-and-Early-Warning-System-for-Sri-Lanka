from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    from app.routes import api
    app.register_blueprint(api, url_prefix="/api")

    @app.route("/")
    def index():
        return """
        <html>
            <head>
                <title>Sri Lanka Flood Risk Prediction API</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background: #0f172a;
                        color: #f8fafc;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                    }
                    .card {
                        background: #1e293b;
                        padding: 2.5rem;
                        border-radius: 12px;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
                        max-width: 500px;
                        text-align: center;
                        border: 1px solid #334155;
                    }
                    h1 { color: #38bdf8; margin-top: 0; }
                    p { color: #94a3b8; line-height: 1.6; }
                    .btn {
                        display: inline-block;
                        background: #0284c7;
                        color: white;
                        text-decoration: none;
                        padding: 0.75rem 1.5rem;
                        border-radius: 6px;
                        font-weight: bold;
                        margin-top: 1.5rem;
                        transition: background 0.2s;
                    }
                    .btn:hover { background: #0369a1; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>🌊 Flood Prediction API</h1>
                    <p>The Flask API server is running successfully!</p>
                    <p>To view the interactive map and dashboard UI, please open the React application in your browser:</p>
                    <a href="http://localhost:5173" class="btn">Go to Frontend (localhost:5173)</a>
                </div>
            </body>
        </html>
        """

    return app
