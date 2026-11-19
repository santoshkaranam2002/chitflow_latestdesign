/** Base URL of the ChitFlow Django REST API. Change this if the backend is hosted somewhere else. */
const LOCAL_API = 'http://127.0.0.1:8000/api';
const STAGING_API = 'https://d5fulnq8bl.execute-api.us-east-1.amazonaws.com/api';
const AWS_API = 'https://xseprvi9ui.execute-api.eu-west-3.amazonaws.com/api';

// Switch here: LOCAL_API (your computer), STAGING_API (staging server) or AWS_API (live server).
export const API_BASE_URL = STAGING_API;