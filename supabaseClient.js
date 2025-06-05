const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ozrmfkgdlmvabekwffkr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96cm1ma2dkbG12YWJla3dmZmtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNDMxMjgsImV4cCI6MjA2NDcxOTEyOH0.C4lsoB_6gAxB2GAEB-6VlEYS0t20UDoISvrQD9EqLkM';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase; 