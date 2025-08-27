const cron = require('node-cron');
const supabase = require('../supabaseClient');

// Daily App Open Challenge - Award 5 points per day
const processDailyAppOpenChallenge = async () => {
  try {
    console.log('Processing Daily App Open Challenge...');
    
    // Get all users who have the Daily App Open Challenge
    const { data: challenges, error: challengesError } = await supabase
      .from('challenges')
      .select('user_id, id, details')
      .eq('challenge_title', 'Daily App Open Challenge')
      .eq('is_redeemed', false);

    if (challengesError) {
      console.error('Error fetching Daily App Open challenges:', challengesError);
      return;
    }

    if (!challenges || challenges.length === 0) {
      console.log('No Daily App Open challenges found');
      return;
    }

    // Get current date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    for (const challenge of challenges) {
      try {
        // Check if user already claimed points for today
        const { data: existingClaim, error: claimError } = await supabase
          .from('challenge_claims')
          .select('id')
          .eq('challenge_id', challenge.id)
          .eq('claim_date', today)
          .single();

        if (claimError && claimError.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error(`Error checking existing claim for user ${challenge.user_id}:`, claimError);
          continue;
        }

        // If already claimed today, skip
        if (existingClaim) {
          console.log(`User ${challenge.user_id} already claimed Daily App Open points for today`);
          continue;
        }

        // Award 5 points to user
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('points')
          .eq('id', challenge.user_id)
          .single();

        if (userError) {
          console.error(`Error fetching user ${challenge.user_id}:`, userError);
          continue;
        }

        const currentPoints = user.points || 0;
        const newPoints = currentPoints + 5;

        // Update user points
        const { error: updateError } = await supabase
          .from('users')
          .update({ points: newPoints })
          .eq('id', challenge.user_id);

        if (updateError) {
          console.error(`Error updating points for user ${challenge.user_id}:`, updateError);
          continue;
        }

        // Record the claim
        const { error: claimRecordError } = await supabase
          .from('challenge_claims')
          .insert({
            challenge_id: challenge.id,
            user_id: challenge.user_id,
            points_awarded: 5,
            claim_date: today
          });

        if (claimRecordError) {
          console.error(`Error recording claim for user ${challenge.user_id}:`, claimRecordError);
        } else {
          console.log(`Awarded 5 points to user ${challenge.user_id} for Daily App Open Challenge`);
        }

      } catch (err) {
        console.error(`Error processing Daily App Open Challenge for user ${challenge.user_id}:`, err);
      }
    }

  } catch (err) {
    console.error('Error in processDailyAppOpenChallenge:', err);
  }
};

// Daily Streak Challenge - Check and award streak points
const processDailyStreakChallenge = async () => {
  try {
    console.log('Processing Daily Streak Challenge...');
    
    // Get all users who have the Daily Streak Challenge
    const { data: challenges, error: challengesError } = await supabase
      .from('challenges')
      .select('user_id, id, details')
      .eq('challenge_title', 'Daily Streak Challenges')
      .eq('is_redeemed', false);

    if (challengesError) {
      console.error('Error fetching Daily Streak challenges:', challengesError);
      return;
    }

    if (!challenges || challenges.length === 0) {
      console.log('No Daily Streak challenges found');
      return;
    }

    // Get current date and yesterday
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    for (const challenge of challenges) {
      try {
        // Check if user logged an expense today (between 12:00 AM - 11:59 PM)
        const { data: todayExpenses, error: todayError } = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', challenge.user_id)
          .eq('type', 'expense')
          .gte('date', todayStr)
          .lt('date', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

        if (todayError) {
          console.error(`Error checking today's expenses for user ${challenge.user_id}:`, todayError);
          continue;
        }

        // If no expense logged today, reset streak
        if (!todayExpenses || todayExpenses.length === 0) {
          console.log(`User ${challenge.user_id} didn't log any expenses today, streak reset`);
          
          // Reset streak in challenge details
          const updatedDetails = {
            ...challenge.details,
            current_streak: 0,
            last_expense_date: null
          };

          await supabase
            .from('challenges')
            .update({ details: updatedDetails })
            .eq('id', challenge.id);

          continue;
        }

        // Get current streak from challenge details
        const currentStreak = challenge.details?.current_streak || 0;
        const lastExpenseDate = challenge.details?.last_expense_date;

        // Check if this is a consecutive day
        let newStreak = currentStreak;
        if (!lastExpenseDate || lastExpenseDate === yesterdayStr) {
          newStreak = currentStreak + 1;
        } else if (lastExpenseDate !== todayStr) {
          // Streak broken, reset to 1
          newStreak = 1;
        }

        // Determine points to award based on streak milestones
        let pointsToAward = 0;
        let milestoneReached = null;

        if (newStreak === 3 && currentStreak < 3) {
          pointsToAward = 10;
          milestoneReached = '3-day streak';
        } else if (newStreak === 7 && currentStreak < 7) {
          pointsToAward = 15;
          milestoneReached = '7-day streak';
        } else if (newStreak === 14 && currentStreak < 14) {
          pointsToAward = 20;
          milestoneReached = '14-day streak';
        } else if (newStreak === 21 && currentStreak < 21) {
          pointsToAward = 25;
          milestoneReached = '21-day streak';
        } else if (newStreak === 30 && currentStreak < 30) {
          pointsToAward = 30;
          milestoneReached = '30-day streak';
        }

        // Award points if milestone reached
        if (pointsToAward > 0) {
          const { data: user, error: userError } = await supabase
            .from('users')
            .select('points')
            .eq('id', challenge.user_id)
            .single();

          if (userError) {
            console.error(`Error fetching user ${challenge.user_id}:`, userError);
            continue;
          }

          const currentPoints = user.points || 0;
          const newPoints = currentPoints + pointsToAward;

          // Update user points
          const { error: updateError } = await supabase
            .from('users')
            .update({ points: newPoints })
            .eq('id', challenge.user_id);

          if (updateError) {
            console.error(`Error updating points for user ${challenge.user_id}:`, updateError);
            continue;
          }

          // Record the milestone claim
          const { error: claimRecordError } = await supabase
            .from('challenge_claims')
            .insert({
              challenge_id: challenge.id,
              user_id: challenge.user_id,
              points_awarded: pointsToAward,
              claim_date: todayStr,
              milestone: milestoneReached
            });

          if (claimRecordError) {
            console.error(`Error recording milestone claim for user ${challenge.user_id}:`, claimRecordError);
          } else {
            console.log(`Awarded ${pointsToAward} points to user ${challenge.user_id} for ${milestoneReached}`);
          }
        }

        // Update challenge details with new streak
        const updatedDetails = {
          ...challenge.details,
          current_streak: newStreak,
          last_expense_date: todayStr
        };

        await supabase
          .from('challenges')
          .update({ details: updatedDetails })
          .eq('id', challenge.id);

        console.log(`Updated streak for user ${challenge.user_id} to ${newStreak} days`);

      } catch (err) {
        console.error(`Error processing Daily Streak Challenge for user ${challenge.user_id}:`, err);
      }
    }

  } catch (err) {
    console.error('Error in processDailyStreakChallenge:', err);
  }
};

// Main cron job function that runs every night at 12 AM
const runChallengeCronJob = () => {
  console.log('Starting challenge cron job...');
  
  // Process Daily App Open Challenge
  processDailyAppOpenChallenge();
  
  // Process Daily Streak Challenge
  processDailyStreakChallenge();
  
  console.log('Challenge cron job completed');
};

// Schedule the cron job to run every night at 12 AM
const scheduleChallengeCronJob = () => {
  cron.schedule('0 0 * * *', () => {
    console.log('Running scheduled challenge cron job at midnight...');
    runChallengeCronJob();
  }, {
    scheduled: true,
    timezone: "UTC" 
  });
  
  console.log('Challenge cron job scheduled to run every night at 12 AM');
};

// Manual trigger function for testing
const triggerChallengeCronJob = () => {
  console.log('Manually triggering challenge cron job...');
  runChallengeCronJob();
};

module.exports = {
  scheduleChallengeCronJob,
  triggerChallengeCronJob,
  runChallengeCronJob,
  processDailyAppOpenChallenge,
  processDailyStreakChallenge
};
