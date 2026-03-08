# Initialize Groq client (uses environment variable automatically)

from groq import Groq

client = Groq()

relevant_context = results or qdrant similarity search

user_query = embedded user query

# Construct the prompt with the retrieved context
prompt = f"""
Use the following context to answer the user's question. 
If the answer is not in the context, say that you cannot find the answer.

Context: "{relevant_context}"

Question: "{user_query}"
"""

# Call the Groq API
chat_completion = client.chat.completions.create(
    messages=[
        {
            "role": "system",
            "content": "You are a helpful assistant that answers questions based only on the provided context."
        },
        {
            "role": "user",
            "content": prompt,
        }
    ],
    model="llama3-8b-8192", # Example model, check Groq docs for current models
)

print(chat_completion.choices[0].message.content)
