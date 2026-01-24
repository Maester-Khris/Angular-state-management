const axios = require("axios");

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

module.exports = {getSemanticMatches};