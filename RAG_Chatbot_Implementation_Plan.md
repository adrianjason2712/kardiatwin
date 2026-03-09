# RAG-Powered PulseChatbot: Implementation Plan

This document outlines the architecture and execution steps for transforming the **PulseChatbot** into a data-aware, RAG-powered assistant.

---

## 🏗️ 1. Architecture Overview
The chatbot will use **Retrieval-Augmented Generation (RAG)** to provide answers grounded in both **Medical Documentation** and the **User's Personal Health Data**.

### A. Data Layers
1.  **Static Knowledge Base (The "R"):** Medical documentation (Bruce protocols, heart health FAQs) stored in a local **ChromaDB** vector store.
2.  **Dynamic User Context (The Augmentation):** Real-time vitals (HR, BP), user profile (Age, Smoking Status), and simulation history extracted from the **PostgreSQL** database.
3.  **Local Intelligence (The Generator):** **Ollama** (running Llama3 or Mistral) processing the final context-rich prompt.

---

## 🛠️ 2. Backend Implementation (FastAPI)

### Step 1: `rag_service.py`
- Initialize `ChromaDB` client.
- **`index_documents()`**: Script to process `README_SIMULATION_INPUTS.md` and other docs into the vector DB.
- **`retrieve_knowledge(query)`**: Performs vector search to find relevant medical context.

### Step 2: `context_service.py`
- **`get_user_summary(user_id)`**: Fetches age, gender, lifestyle factors, and simulation history.
- **`get_live_vitals()`**: Fetches current simulation vitals and phase.

### Step 3: `chat_service.py`
- Combines inputs into a **Master Prompt**:
  > You are Pulse, a Cardiac AI.
  > 
  > **MEDICAL KNOWLEDGE:** {retrieved_docs}
  > **USER DATA:** Patient is {age}, {smoking_status}. Current HR: {hr}, Phase: {phase}.
  > **USER QUERY:** {user_message}
  > 
  > Provide a helpful, data-driven answer. Reference the user's current values where relevant.

---

## 📋 3. Execution Roadmap
1.  **Install Dependencies**: `chromadb`, `sentence-transformers`.
2.  **Index Docs**: Run a script to index the README and medical data.
3.  **Implement API**: Create the `/api/chat` endpoint in `main.py`.
4.  **UI Integration**: Update `PulseChatbot.tsx` to call the new API.

---
*Created: March 2, 2026 | Project: KardiaTwin*
