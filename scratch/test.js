require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function test() {
  const { data, error } = await supabase
    .from('ARTIST')
    .select(`
        ARTIST_ID,
        Artist_Type,
        Bio,
        Links,
        Status,
        Is_Verified,
        Created_at,
        USER_ACCOUNT:ACCOUNT_ID (
            Username, Email, City, Barangay, Profile_Picture, Created_at
        ),
        SOLO_ARTIST ( 
            Artist_Name, Specialty, 
            SOLO_GENRES ( TAG_GENRE ( Name ) ), 
            SOLO_INSTRUMENTS ( TAG_INSTRUMENT ( Name ) ) 
        ),
        BAND ( 
            Band_Name, Formation_Date, 
            BAND_GENRES ( TAG_GENRE ( Name ) ) 
        )
    `);
  console.log("Error:", error);
  console.log("Data:", JSON.stringify(data, null, 2));
}

test();
