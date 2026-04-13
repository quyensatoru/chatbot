# 1. Tool Definitions for Agent

This markdown file defines the tools that the agent will use to perform various tasks. Each tool is described with its purpose, implementation details, and usage instructions. 

# ─── TOOL GENERATION INSTRUCTIONS FOR AI AGENT ───────────────────────────────
# Follow every rule below when generating LangChain tools + Zod schemas.

## STACK
- Language  : javascript
- Framework : LangChain  →  import { tool } from "langchain/tools"
- Validator  : Zod        →  import * as z from "zod"

# These two import lines must appear at the top of every generated file.
# Do NOT use any other import path or alias for these two libraries.


## TOOL STRUCTURE  required

Each tool must include ALL of the following fields:

  name        — snake_case, verb_noun format (e.g. `get_user_profile`, `send_email`).
               Must be unique and self-describing so the agent knows WHEN to call it.

  description — 2–4 sentences answering:
               (1) What does this tool do?
               (2) When should the agent call it? (trigger condition)
               (3) What does it return?
               ❌ Vague  : "handles user data"
               ✅ Good   : "Fetches a user's full profile from the database by their
                           UUID. Call this when you need personal info, roles, or
                           settings of a specific user. Returns a UserProfile object
                           or null if not found."

  schema      — Zod object (see SCHEMA RULES below)

  func        — async function that implements the tool logic


## SCHEMA RULES  required

Every field in the Zod schema MUST have .describe("...") that explains:
  - What this field is used for
  - Accepted format / allowed values

  // ❌ Bad
  userId: z.string().describe("user id")

  // ✅ Good
  userId: z.string().uuid()
           .describe("UUID of the target user (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).
                      Used to look up the user record in the database.")

Use the most specific validator available:

  z.string().min(1)            // non-empty string
  z.string().uuid()            // UUID format
  z.string().email()           // email address
  z.string().url()             // full URL with protocol
  z.number().int().positive()  // positive integer
  z.enum(["a", "b", "c"])      // fixed set of allowed values
  z.array(z.string()).min(1)   // non-empty array
  field.optional().default(x)  // optional field — always pair with .default()


## RETURN TYPE  recommended

- Define an explicit TypeScript return type for the tool function.
- On success : return a typed object (not a raw string).
- On failure : throw a ToolException with a human-readable message so the
  agent can decide the next step without hallucinating error details.


## NAMING CONVENTIONS  required

  Tool name    : snake_case   →  `search_product_catalog`
  Schema field : camelCase   →  `userId`, `maxResults`
  Zod schema   : PascalCase  →  `SearchProductInput`


## OUTPUT FORMAT  strict

Generate exactly this structure for every tool:

import * as z from "zod";
import { tool } from "langchain/tools";

// 1. Schema
const ToolNameInput = z.object({
  fieldName: z.string().uuid()
    .describe("...what it is and how it is used..."),
});

// 2. Tool
export const toolName = tool(
  async (input) => {
    // implementation
  },
  {
    name: "tool_name",
    description: "...",
    schema: ToolNameInput,
  }
);

# No default exports. Schema always defined before the tool that uses it.

## 7.1. Tool 1: Web Search

**Name:** `web_search`

**Description:**
This tool allows the agent to perform web searches using the Tavily API.

**Implementation Details:**
- Library: Tavily
- Functionality: Sends search queries to the Tavily API and retrieves results.

**Usage:**
- Input: Search query string.
- Output: List of search results with titles and URLs.

---

## 7.2. Tool 2: Math Calculation

**Name:** `calculate_math`

**Description:**
This tool performs mathematical calculations using the Math.js library.

**Implementation Details:**
- Library: Math.js
- Functionality: Evaluates mathematical expressions and returns the result.

**Usage:**
- Input: Mathematical expression as a string.
- Output: Result of the calculation.

---

## 7.3. Tool 3: API Call

**Name:** `api_call`

**Description:**
This tool allows the agent to make API calls using Axios or Fetch.

**Implementation Details:**
- Library: Axios or Fetch
- Functionality: Sends HTTP requests to specified API endpoints with the given method, headers, and body.

**Usage:**
- Input: API endpoint, HTTP method, headers, and body.
- Output: Response data from the API.

---

## 7.4. Tool 4: Current Time

**Name:** `current_time`

**Description:**
This tool provides the current date and time.

**Implementation Details:**
- Functionality: Retrieves the current system time.

**Usage:**
- Input: None.
- Output: Current date and time in ISO format.

---
