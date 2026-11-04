import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import manifest from '../../seeds/article-covers.json' with {type:'json'};
import {createCoverImportHandler} from './importer.mjs';

// Disabled by default. A deployment operator must explicitly provide a scoped,
// expiring job; no passwords or server keys are embedded in source files.
const job={tokenHash:Deno.env.get('ARTICLE_COVER_JOB_TOKEN_HASH')??'',ownerId:Deno.env.get('ARTICLE_COVER_JOB_OWNER_ID')??'',expiresAt:Deno.env.get('ARTICLE_COVER_JOB_EXPIRES_AT')??'2000-01-01T00:00:00Z'};
const secrets=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')??'{}');
const key=secrets.default??Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const client=createClient(Deno.env.get('SUPABASE_URL')!,key!,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createCoverImportHandler({client,manifest,job}));
