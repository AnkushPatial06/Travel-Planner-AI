from crewai import LLM

llm = LLM(
    model="groq/llama-3.3-70b-versatile",
    api_key="YOUR_GROQ_KEY"
)

print(llm)