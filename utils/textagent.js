const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Extract transaction details from image using OCR
async function extractTransactionFromImage(imageUrl, categories) {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a financial transaction extractor. Analyze the image and extract transaction details. Return ONLY a raw JSON object with the following structure, no markdown formatting, no code blocks, no additional text:

{
  "amount": <number>,
  "type": <"income" | "expense" | "transfer" | "investment">,
  "title": <string>,
  "description": <string>,
  "category": <string>,
  "date": <"YYYY-MM-DD">
}

Available categories: ${categories.join(', ')}

Rules:
- amount: Extract the monetary value as a number
- type: Determine if it's income, expense, transfer, or investment based on context
- title: Create a brief, descriptive title for the transaction
- description: Provide a detailed description of what the transaction is for
- category: Choose the most appropriate category from the provided list
- date: If date is visible, use it; otherwise use today's date in YYYY-MM-DD format
- If any field cannot be determined, use reasonable defaults
- IMPORTANT: Return ONLY the JSON object, no markdown, no code blocks, no explanations`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract transaction details from this image. Return only the JSON object, no other text."
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.1
    });

    const extractedText = response.choices[0].message.content.trim();
    
    // Try to parse the JSON response
    try {
      console.log(extractedText);
      
      // Extract JSON from markdown code blocks if present
      let jsonText = extractedText;
      if (extractedText.includes('```json')) {
        const jsonMatch = extractedText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1].trim();
        }
      } else if (extractedText.includes('```')) {
        // Handle case where it's just ``` without json specification
        const codeMatch = extractedText.match(/```\s*([\s\S]*?)\s*```/);
        if (codeMatch) {
          jsonText = codeMatch[1].trim();
        }
      }
      
      const transactionData = JSON.parse(jsonText);
      
      // Validate and set defaults for missing fields
      const today = new Date().toISOString().split('T')[0];
      
      return {
        amount: transactionData.amount || 0,
        type: transactionData.type || 'expense',
        title: transactionData.title || 'Transaction from image',
        description: transactionData.description || 'Transaction extracted from uploaded image',
        category: transactionData.category || 'Shopping',
        date: transactionData.date || today
      };
    } catch (parseError) {
      console.error('Error parsing OCR response:', parseError);
      // Return default transaction if parsing fails
      const today = new Date().toISOString().split('T')[0];
      return {
        amount: 0,
        type: 'expense',
        title: 'Transaction from image',
        description: 'Transaction extracted from uploaded image',
        category: 'Shopping',
        date: today
      };
    }
  } catch (error) {
    console.error('Error in OCR extraction:', error);
    throw new Error('Failed to extract transaction details from image');
  }
}

// Extract monthly income from text
async function extractMonthlyIncome(prompt) {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a financial data extractor. Extract the monthly income amount from the user's text. Return only a number. If no income is mentioned, return 0. Examples: 'my monthly income is 1000' → 1000, 'I earn 1500 per month' → 1500, 'salary is 2000 monthly' → 2000"
        },
        {
          role: "user",
          content: `Extract the monthly income from this text: "${prompt}". Return only the number, no other text.`
        }
      ],
      max_tokens: 10,
      temperature: 0.1
    });

    const extractedAmount = response.choices[0].message.content.trim();
    const amount = parseFloat(extractedAmount) || 0;
    return amount;
  } catch (error) {
    console.error('Error extracting monthly income:', error);
    return 0;
  }
}

// Extract monthly expense from text
async function extractMonthlyExpense(prompt) {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a financial data extractor. Extract the monthly expense amount from the user's text. Return only a number. If no expense is mentioned, return 0. Examples: 'I spend 800 monthly' → 800, 'monthly expenses are 1200' → 1200, 'costs me 600 per month' → 600"
        },
        {
          role: "user",
          content: `Extract the monthly expense from this text: "${prompt}". Return only the number, no other text.`
        }
      ],
      max_tokens: 10,
      temperature: 0.1
    });

    const extractedAmount = response.choices[0].message.content.trim();
    const amount = parseFloat(extractedAmount) || 0;
    return amount;
  } catch (error) {
    console.error('Error extracting monthly expense:', error);
    return 0;
  }
}

// Extract amount to save from text
async function extractAmountToSave(prompt) {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a financial data extractor. Extract the amount to save from the user's text. Return only a number. If no savings amount is mentioned, return 0. Examples: 'I want to save 200 monthly' → 200, 'save 300 per month' → 300, 'monthly savings goal is 500' → 500"
        },
        {
          role: "user",
          content: `Extract the amount to save from this text: "${prompt}". Return only the number, no other text.`
        }
      ],
      max_tokens: 10,
      temperature: 0.1
    });

    const extractedAmount = response.choices[0].message.content.trim();
    const amount = parseFloat(extractedAmount) || 0;
    return amount;
  } catch (error) {
    console.error('Error extracting amount to save:', error);
    return 0;
  }
}

// Extract transaction details from text
async function extractTransactionFromText(prompt, categories) {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a financial transaction extractor. Analyze the text and extract transaction details. Return ONLY a raw JSON object with the following structure, no markdown formatting, no code blocks, no additional text:

{
  "amount": <number>,
  "type": <"income" | "expense" | "transfer" | "investment">,
  "title": <string>,
  "description": <string>,
  "category": <string>,
  "date": <"YYYY-MM-DD">
}

Available categories: ${categories.join(', ')}

Rules:
- amount: Extract the monetary value as a number
- type: Determine if it's income, expense, transfer, or investment based on context (usually expense for purchases)
- title: Create a brief, descriptive title for the transaction
- description: Provide a detailed description of what the transaction is for
- category: Choose the most appropriate category from the provided list
- date: If date is visible, use it; otherwise use today's date in YYYY-MM-DD format
- If any field cannot be determined, use reasonable defaults
- IMPORTANT: Return ONLY the JSON object, no markdown, no code blocks, no explanations`
        },
        {
          role: "user",
          content: `Extract transaction details from this text: "${prompt}". Return only the JSON object, no other text.`
        }
      ],
      max_tokens: 500,
      temperature: 0.1
    });

    const extractedText = response.choices[0].message.content.trim();
    
    // Try to parse the JSON response
    try {
      console.log(extractedText);
      
      // Extract JSON from markdown code blocks if present
      let jsonText = extractedText;
      if (extractedText.includes('```json')) {
        const jsonMatch = extractedText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1].trim();
        }
      } else if (extractedText.includes('```')) {
        // Handle case where it's just ``` without json specification
        const codeMatch = extractedText.match(/```\s*([\s\S]*?)\s*```/);
        if (codeMatch) {
          jsonText = codeMatch[1].trim();
        }
      }
      
      const transactionData = JSON.parse(jsonText);
      
      // Validate and set defaults for missing fields
      const today = new Date().toISOString().split('T')[0];
      
      return {
        amount: transactionData.amount || 0,
        type: transactionData.type || 'expense',
        title: transactionData.title || 'Transaction from text',
        description: transactionData.description || 'Transaction extracted from text prompt',
        category: transactionData.category || 'Shopping',
        date: transactionData.date || today
      };
    } catch (parseError) {
      console.error('Error parsing text extraction response:', parseError);
      // Return default transaction if parsing fails
      const today = new Date().toISOString().split('T')[0];
      return {
        amount: 0,
        type: 'expense',
        title: 'Transaction from text',
        description: 'Transaction extracted from text prompt',
        category: 'Shopping',
        date: today
      };
    }
  } catch (error) {
    console.error('Error in text extraction:', error);
    throw new Error('Failed to extract transaction details from text');
  }
}

// Extract today's spend from text
async function extractTodaySpend(prompt) {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a financial data extractor. Extract the amount spent today from the user's text. Return only a number. If no spending amount is mentioned, return 0. Examples: 'I spent 50 today' → 50, 'today I spent 75' → 75, 'spent 30 on lunch today' → 30"
        },
        {
          role: "user",
          content: `Extract the amount spent today from this text: "${prompt}". Return only the number, no other text.`
        }
      ],
      max_tokens: 10,
      temperature: 0.1
    });

    const extractedAmount = response.choices[0].message.content.trim();
    const amount = parseFloat(extractedAmount) || 0;
    return amount;
  } catch (error) {
    console.error('Error extracting today spend:', error);
    return 0;
  }
}

// Legacy function for backward compatibility
async function askClaude(prompt) {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    return {
      content: [{
        text: response.choices[0].message.content
      }]
    };
  } catch (error) {
    console.error('Error in askClaude:', error);
    throw error;
  }
}

module.exports = {
  extractTransactionFromImage,
  extractTransactionFromText,
  extractMonthlyIncome,
  extractMonthlyExpense,
  extractAmountToSave,
  extractTodaySpend,
  askClaude
};
