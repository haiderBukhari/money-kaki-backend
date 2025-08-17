const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Extract monthly income from text
async function extractMonthlyIncome(prompt) {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1",
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
      model: "gpt-4.1",
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
      model: "gpt-4.1",
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

// Extract today's spend from text
async function extractTodaySpend(prompt) {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1",
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
      model: "gpt-4.1",
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
  extractMonthlyIncome,
  extractMonthlyExpense,
  extractAmountToSave,
  extractTodaySpend,
  askClaude
};
