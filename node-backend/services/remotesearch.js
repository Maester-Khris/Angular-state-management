const axios = require("axios");

const checkPythonStatus = async () => {
    try {
        // Assuming your Flask app has a basic /health or / root endpoint
        const response = await axios.get(`http://localhost:5000/health`, { timeout: 2000 });
        return response.status === 200 ? "connected" : "error";
    } catch (error) {
        return "disconnected";
    }
};

const getSemanticMatches = async (Query, limit=10) => {
    try{
        const response = await axios.post(`http://localhost:5000/search`, {
            "query": Query,
            "limit": limit
        });
        return response.data.results || [];
    }catch(error){
        console.error("Python Service unreachable:", error.message);
        return []; // Return empty so the orchestrator can still use Mongo results
    }
}

module.exports = {getSemanticMatches, checkPythonStatus};