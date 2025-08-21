import { execSync } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupHerokuEnv() {
  console.log('🚀 Setting up Heroku Environment Variables for ajws-school\n');
  
  try {
    // Get Supabase URL
    const supabaseUrl = await question('Enter your Supabase URL (e.g., https://your-project.supabase.co): ');
    
    // Get Supabase Anon Key
    const supabaseAnonKey = await question('Enter your Supabase Anon Key: ');
    
    // Get Supabase Service Role Key
    const supabaseServiceRoleKey = await question('Enter your Supabase Service Role Key: ');
    
    // Get JWT Secret
    const jwtSecret = await question('Enter your JWT Secret (or press Enter to generate a random one): ');
    
    const finalJwtSecret = jwtSecret || Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    console.log('\n📝 Setting environment variables...\n');
    
    // Set environment variables
    const commands = [
      `heroku config:set SUPABASE_URL="${supabaseUrl}"`,
      `heroku config:set SUPABASE_ANON_KEY="${supabaseAnonKey}"`,
      `heroku config:set SUPABASE_SERVICE_ROLE_KEY="${supabaseServiceRoleKey}"`,
      `heroku config:set JWT_SECRET="${finalJwtSecret}"`
    ];
    
    for (const command of commands) {
      console.log(`Running: ${command}`);
      try {
        execSync(command, { stdio: 'inherit' });
        console.log('✅ Success\n');
      } catch (error) {
        console.log('❌ Error setting environment variable\n');
      }
    }
    
    console.log('🎉 Environment variables setup complete!');
    console.log('\nNext steps:');
    console.log('1. Deploy your app: git push heroku main');
    console.log('2. Run database migrations: heroku pg:psql');
    console.log('3. Check your app: heroku open');
    
  } catch (error) {
    console.error('❌ Error during setup:', error.message);
  } finally {
    rl.close();
  }
}

setupHerokuEnv();
