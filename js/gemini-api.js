// Centralized Gemini API integration
export class GeminiAPI {
  constructor() {
    this.apiKey = "AIzaSyDEOFoXBAnnaCPFonvVskSIXW5n5m6M5bQ" // User's actual API key
    this.model = "gemini-2.5-flash";
    this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
  }

  async generateContent(prompt, context = "") {
    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: context ? `${context}\n\n${prompt}` : prompt,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errData = await response.json();
          if (errData && errData.error && errData.error.message) {
            errorMsg += `\n${errData.error.message}`;
          }
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const data = await response.json();
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0].text) {
        throw new Error("Gemini API returned an unexpected response format.");
      }
      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error("Gemini API Error:", error);
      alert("There was a problem communicating with the Gemini API. Please check your API key, endpoint, and try again.\n" + error.message);
      throw error;
    }
  }

  async generateInterviewQuestions(jobTitle, isTechnical = false, count = 1) {
    if (isTechnical && count === 10) {
      const prompt = `Generate exactly 10 professional interview questions for a ${jobTitle} position.

1-5: Behavioral (non-coding) questions. These should focus on soft skills, teamwork, problem-solving, communication, and situational judgment. Do NOT include any coding or programming in these.
6-10: Coding/programming questions. These should require the candidate to write code, solve algorithms, or implement functions. Each should be suitable for a technical interview.

Format: Return exactly 10 questions, numbered 1-10, one per line. The first 5 must be behavioral, the last 5 must be coding/programming questions. Make the questions realistic and commonly asked in interviews.`;
      return await this.generateContent(prompt);
    } else {
      const technicalNote = isTechnical
        ? "Include both behavioral and technical questions. For technical questions, focus on problem-solving and coding concepts."
        : "Focus on behavioral and situational questions."

      const prompt = `Generate ${count} professional interview question${count > 1 ? "s" : ""} for a ${jobTitle} position. 
        ${technicalNote}
        
        Format: Return only the question${count > 1 ? "s" : ""}, one per line if multiple.
        Make the questions realistic and commonly asked in interviews.`

      return await this.generateContent(prompt)
    }
  }

  async generateMockInterviewQuestions(resumeText, jobDescription, isTechnical = false) {
    const technicalNote = isTechnical
      ? "Include 3-4 technical/coding questions and 6-7 behavioral questions."
      : "Focus on behavioral and situational questions based on the resume and job requirements."

    const prompt = `Based on this resume and job description, generate exactly 10 interview questions:

        RESUME:
        ${resumeText}

        JOB DESCRIPTION:
        ${jobDescription}

        ${technicalNote}

        Format: Return exactly 10 questions, numbered 1-10, one per line.
        Make questions specific to the candidate's experience and the job requirements.`

    return await this.generateContent(prompt)
  }

  async evaluateAnswer(question, answer, jobContext) {
    const prompt = `Evaluate this interview answer:

        Question: ${question}
        Answer: ${answer}
        Job Context: ${jobContext}

        Provide a score from 1-10 and brief feedback on:
        1. Relevancy to the question
        2. Completeness of the answer
        3. Professional communication
        4. Specific improvements

        Format: 
        Score: X/10
        Feedback: [Your detailed feedback]`

    return await this.generateContent(prompt)
  }

  async generateResumeSuggestions(resumeData) {
    const prompt = `Analyze this resume data and provide specific improvement suggestions:

        ${JSON.stringify(resumeData, null, 2)}

        Provide suggestions for:
        1. Professional Summary improvements
        2. Experience section enhancements
        3. Skills optimization
        4. Overall formatting and structure
        5. Missing elements that should be added

        Be specific and actionable in your recommendations.`

    return await this.generateContent(prompt)
  }

  async generateComprehensiveFeedback(answers, confidenceScores, jobContext, isTechnical) {
    const prompt = `Provide comprehensive interview feedback based on:

        Job Context: ${jobContext}
        Technical Role: ${isTechnical ? "Yes" : "No"}
        
        Answers and Performance:
        ${answers
          .map(
            (answer, index) => `
        Q${index + 1}: ${answer.question}
        Answer: ${answer.response}
        Confidence Score: ${confidenceScores[index] || "N/A"}%
        `,
          )
          .join("\n")}

        Please return your response in the following JSON format:
        {
          "overallConfidence": <number 0-100>,
          "answerRelevancy": <number 0-100>,
          "communicationSkills": <number 0-100>,
          "technicalSkills": <number 0-100 or null>,
          "detailedFeedback": "<detailed feedback as markdown or HTML>"
        }
        
        - If the role is not technical, set technicalSkills to null or "N/A".
        - The detailedFeedback field should contain your full written feedback and recommendations.
        - Do not include any text outside the JSON object.
        `;

    return await this.generateContent(prompt);
  }

  async generateCodingQuestion(difficulty = "medium") {
    const prompt = `Generate a ${difficulty} level coding interview question suitable for a software engineering interview.

        Include:
        1. Problem statement
        2. Input/output examples
        3. Constraints
        4. Expected time complexity

        Make it a realistic question that tests problem-solving skills.`

    return await this.generateContent(prompt)
  }
}

// Global instance
const geminiAPI = new GeminiAPI();
