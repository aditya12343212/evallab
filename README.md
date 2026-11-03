# evallab

# EvalLab – LLM Evaluation Platform

## Overview

EvalLab is an LLM Evaluation Platform designed to evaluate, analyze, and compare Large Language Models (LLMs).

It helps developers understand how well an LLM performs by analyzing generated responses against evaluation criteria, identifying quality issues, and tracking results.

## Problem Statement

LLMs can generate incorrect, irrelevant, or hallucinated responses. Evaluating their performance manually is time-consuming and difficult.

EvalLab aims to simplify this process by providing a platform to run evaluations, analyze results, compare responses, and monitor model performance.

## Key Features

- **LLM Evaluation:** Evaluate generated responses using defined evaluation criteria.
- **Response Analysis:** Analyze response quality and identify potential issues.
- **LLM-as-a-Judge:** Use an LLM-based judging approach for evaluation.
- **Model Comparison:** Compare evaluation results and response differences.
- **Evaluation History:** Track and review previous evaluation runs.
- **Visual Analytics:** View evaluation results through charts and statistics.
- **Response Diff:** Identify differences between generated responses.

## Tech Stack

| Component | Technology |
|---|---|
| Frontend | React.js |
| Build Tool | Vite |
| Backend | Node.js |
| API | REST API |
| Language | JavaScript |

## Project Structure

```text
evallab/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   └── styles.css
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── analysis.js
│   │   ├── judge.js
│   │   ├── llm.js
│   │   ├── runner.js
│   │   └── store.js
│   └── package.json
│
└── README.md
```

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/aditya12343212/evallab.git
cd evallab/evallab
```

### 2. Install frontend dependencies

```bash
cd client
npm install
```

### 3. Install backend dependencies

```bash
cd ../server
npm install
```

### 4. Configuration

Configure the required environment variables using the provided `.env.example` file.

### 5. Run the application

Check the scripts in the frontend and backend `package.json` files to start both services.

## Future Improvements

- Add more LLM evaluation metrics.
- Integrate multiple LLM providers.
- Improve hallucination detection.
- Add automated evaluation pipelines.
- Enhance evaluation dashboards and reporting.

## Author

**Aditya Jagtap**

GitHub: https://github.com/aditya12343212

