const axios = require("axios");

const INTERNAL_KEY = process.env.SHARED_SECURITY_KEY || 'SECRET';
const PYTHON_BASE_URL = process.env.NODE_ENV === 'production'
    ? process.env.PYTHON_SERVICE_URL
    : 'http://localhost:5000';


const checkPythonStatus = async () => {
    try {

        // Assuming your Flask app has a basic /health or / root endpoint
        const response = await axios.get(`${PYTHON_BASE_URL}/health`, {
            timeout: 5000, // Increased for free-tier 'wake up'
            headers: { 'X-Internal-Key': INTERNAL_KEY }
        });
        // console.log("python response", response);
        return response.status === 200 ? "connected" : "error";
    } catch (error) {
        console.error("python error", error);
        return "disconnected";
    }
};

const getSemanticMatches = async (Query, limit = 10) => {
    try {
        const response = await axios.post(`${PYTHON_BASE_URL}/search`, {
            "query": Query,
            "limit": limit
        }, {
            headers: { 'X-Internal-Key': INTERNAL_KEY }
        });
        return response.data.results || [];
    } catch (error) {
        console.error(`[${process.env.NODE_ENV}] Python Service unreachable:`, error.message);
        return [];
    }
}

module.exports = { getSemanticMatches, checkPythonStatus };