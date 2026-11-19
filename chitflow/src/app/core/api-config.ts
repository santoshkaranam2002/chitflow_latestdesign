/** Base URL of the ChitFlow Django REST API. Change this if the backend is hosted somewhere else. */
const LOCAL_API = 'http://127.0.0.1:8000/api';
const AWS_API = 'https://xseprvi9ui.execute-api.eu-west-3.amazonaws.com/api';

// Switch here: use LOCAL_API while testing on your computer, AWS_API for the live server.
export const API_BASE_URL = LOCAL_API;