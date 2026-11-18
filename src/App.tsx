import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type Screen = 'home' | 'login' | 'signup' | 'account' | 'admin' | 'study'
type Track = 'k12' | 'gk_gs'
type AdminTab = 'overview' | 'questions' | 'editor' | 'contacts' | 'guardians'
type Profile = { id:string; username:string; display_name:string|null; contact_phone:string|null; age_group:'under_18'|'18_plus'|null; guardian_consent_status:string; marketing_opt_in:boolean; marketing_channels:string[] }
type SchoolClass = { id:string; class_number:number; stage:string; display_name:string }
type Subject = { id:string; name:string; track:Track; school_class_id:string|null; display_order:number }
type Topic = { id:string; subject_id:string; name:string; slug:string; display_order:number }
type ExamCategory = { id:string; name:string; slug:string }
type QuestionOption = { id:string; text?:string; option_text?:string; sort_order:number }
type AdminQuestion = { id:string; track:Track; class_number:number|null; subject_id:string; subject_name:string; topic_id:string; topic_name:string; question_type:'mcq'|'written'|'numerical'; prompt:string; difficulty:string; status:string; marks:number; negative_marks:number; options:QuestionOption[]; correct_option_id:string|null; accepted_answers:string[]; explanation:string|null; exam_category_ids:string[] }
type Question = { id:string; prompt:string; question_type:'mcq'|'written'|'numerical'; difficulty:string; marks:number; negative_marks:number; question_options:QuestionOption[] }
type ContactRow = { user_id:string; username:string; display_name:string; email:string; contact_phone:string; marketing_opt_in_at:string; marketing_channels:string[] }
type GuardianRow = { user_id:string; username:string; display_name:string; guardian_name:string; guardian_email:string; guardian_phone:string; guardian_consent_status:string; created_at:string }
type EditorState = { id:string|null; track:Track; class_id:string; subject_id:string; topic_id:string; question_type:'mcq'|'written'|'numerical'; prompt:string; difficulty:string; status:'draft'|'published'; marks:string; negative_marks:string; options:string[]; correct_option_index:number; accepted_answers:string; explanation:string; exam_category_ids:string[] }
type PracticeResult = { attempt_id:string; status:string; is_correct:boolean|null; marks_awarded:number|null; correct_option_id:string|null; explanation:string|null }
const groups = [
  { title:'Primary', range:'Classes 1–5', copy:'Build strong foundations in core subjects.', icon:'✳' },
  { title:'Middle school', range:'Classes 6–8', copy:'Strengthen concepts and problem-solving skills.', icon:'⌁' },
  { title:'Secondary', range:'Classes 9–10', copy:'Practise concepts and prepare with confidence.', icon:'◇' },
  { title:'Senior secondary', range:'Classes 11–12', copy:'Go deeper with focused subject practice.', icon:'↗' },
]
const gkgs = [
  { title:'Static GK', copy:'Facts, places, awards, books, important days and more.' },
  { title:'General Science', copy:'Physics, Chemistry and Biology for exam practice.' },
  { title:'Indian History', copy:'Ancient, Medieval and Modern Indian History.' },
  { title:'Geography', copy:'Indian and World Geography, maps and environment.' },
  { title:'Indian Polity', copy:'Constitution, governance, rights and institutions.' },
  { title:'Indian Economy', copy:'Economic concepts, policies and key indicators.' },
  { title:'Current Affairs', copy:'Important national and international developments.' },
  { title:'Environment', copy:'Ecology, biodiversity and environmental awareness.' },
]
const emptyEditor:EditorState = { id:null,track:'k12',class_id:'',subject_id:'',topic_id:'',question_type:'mcq',prompt:'',difficulty:'medium',status:'draft',marks:'1',negative_marks:'0',options:['','','',''],correct_option_index:0,accepted_answers:'',explanation:'',exam_category_ids:[] }
function arr<T>(v:unknown):T[]{ return Array.isArray(v) ? v as T[] : [] }
function errText(e:unknown){ return e instanceof Error ? e.message : 'Something went wrong. Please try again.' }
function dateText(v?:string){ return v ? new Date(v).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}) : '—' }

export default function App(){
  const [screen,setScreen]=useState<Screen>('home')
  const [session,setSession]=useState<Session|null>(null)
  const [authReady,setAuthReady]=useState(false)
  const [profile,setProfile]=useState<Profile|null>(null)
  const [profileLoading,setProfileLoading]=useState(false)
  const [isAdmin,setIsAdmin]=useState(false)

  const [authMode,setAuthMode]=useState<'login'|'signup'>('login')
  const [fullName,setFullName]=useState('')
  const [accountEmail,setAccountEmail]=useState('')
  const [phone,setPhone]=useState('')
  const [ageGroup,setAgeGroup]=useState<'18_plus'|'under_18'>('18_plus')
  const [guardianName,setGuardianName]=useState('')
  const [guardianPhone,setGuardianPhone]=useState('')
  const [guardianConsent,setGuardianConsent]=useState(false)
  const [adultMarketing,setAdultMarketing]=useState(false)
  const [marketingChannels,setMarketingChannels]=useState<string[]>(['email'])
  const [password,setPassword]=useState('')
  const [authBusy,setAuthBusy]=useState(false)
  const [authError,setAuthError]=useState('')
  const [authMessage,setAuthMessage]=useState('')
  const [marketingBusy,setMarketingBusy]=useState(false)
  const [marketingMessage,setMarketingMessage]=useState('')

  const [adminTab,setAdminTab]=useState<AdminTab>('overview')
  const [adminBusy,setAdminBusy]=useState(false)
  const [adminError,setAdminError]=useState('')
  const [overview,setOverview]=useState<Record<string,number>>({})
  const [adminQuestions,setAdminQuestions]=useState<AdminQuestion[]>([])
  const [adminSearch,setAdminSearch]=useState('')
  const [trackFilter,setTrackFilter]=useState<'all'|Track>('all')
  const [statusFilter,setStatusFilter]=useState('all')
  const [classes,setClasses]=useState<SchoolClass[]>([])
  const [subjects,setSubjects]=useState<Subject[]>([])
  const [topics,setTopics]=useState<Topic[]>([])
  const [examCategories,setExamCategories]=useState<ExamCategory[]>([])
  const [editor,setEditor]=useState<EditorState>(emptyEditor)
  const [editorBusy,setEditorBusy]=useState(false)
  const [editorMessage,setEditorMessage]=useState('')
  const [contacts,setContacts]=useState<ContactRow[]>([])
  const [guardians,setGuardians]=useState<GuardianRow[]>([])
  const [guardianNotes,setGuardianNotes]=useState<Record<string,string>>({})

  const [studyTrack,setStudyTrack]=useState<Track>('k12')
  const [studyClass,setStudyClass]=useState('')
  const [studySubject,setStudySubject]=useState('')
  const [studyTopic,setStudyTopic]=useState('')
  const [questions,setQuestions]=useState<Question[]>([])
  const [questionIndex,setQuestionIndex]=useState(0)
  const [practiceSession,setPracticeSession]=useState<string|null>(null)
  const [studyBusy,setStudyBusy]=useState(false)
  const [studyError,setStudyError]=useState('')
  const [chosenOption,setChosenOption]=useState('')
  const [answerText,setAnswerText]=useState('')
  const [answerResult,setAnswerResult]=useState<PracticeResult|null>(null)
  const [answerBusy,setAnswerBusy]=useState(false)
  const [bookmarked,setBookmarked]=useState(false)

  useEffect(()=>{
    if(!supabase){setAuthReady(true);return}
    let live=true
    supabase.auth.getSession().then(({data})=>{if(live){setSession(data.session);setAuthReady(true)}}).catch(()=>{if(live)setAuthReady(true)})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next))
    return ()=>{live=false;subscription.unsubscribe()}
  },[])

  useEffect(()=>{
    if(!supabase||!session?.user.id){setProfile(null);setIsAdmin(false);setProfileLoading(false);return}
    let live=true
    setProfileLoading(true)
    Promise.all([
      supabase.from('profiles').select('*').eq('id',session.user.id).maybeSingle(),
      supabase.rpc('current_user_is_admin'),
    ]).then(([p,a])=>{
      if(!live)return
      if(p.error)setAuthError(p.error.message)
      setProfile(p.data as Profile|null)
      setIsAdmin(Boolean(a.data))
      setProfileLoading(false)
    }).catch(e=>{if(live){setAuthError(errText(e));setProfileLoading(false)}})
    return ()=>{live=false}
  },[session?.user.id])

  const go=useCallback((next:Screen)=>{setScreen(next);setAuthError('');setAuthMessage('');window.scrollTo({top:0,behavior:'smooth'})},[])
  const openAuth=(mode:'login'|'signup')=>{setAuthMode(mode);setPassword('');setAuthError('');setAuthMessage('');go(mode)}

  const loadTaxonomy=useCallback(async()=>{
    if(!supabase)return
    const [c,s,t,e]=await Promise.all([
      supabase.from('school_classes').select('id,class_number,stage,display_name').order('class_number'),
      supabase.from('subjects').select('id,name,track,school_class_id,display_order').order('display_order'),
      supabase.from('topics').select('id,subject_id,name,slug,display_order').order('display_order'),
      supabase.from('exam_categories').select('id,name,slug').eq('is_active',true).order('sort_order'),
    ])
    if(c.error||s.error||t.error||e.error)throw c.error||s.error||t.error||e.error
    setClasses(arr<SchoolClass>(c.data));setSubjects(arr<Subject>(s.data));setTopics(arr<Topic>(t.data));setExamCategories(arr<ExamCategory>(e.data))
  },[])

  const loadAdmin=useCallback(async()=>{
    if(!supabase||!isAdmin)return
    setAdminBusy(true);setAdminError('')
    try{
      const [o,q]=await Promise.all([
        supabase.rpc('admin_get_overview'),
        supabase.rpc('admin_list_questions',{
          p_track:trackFilter==='all'?null:trackFilter,
          p_status:statusFilter==='all'?null:statusFilter,
          p_search:adminSearch.trim()||null,p_limit:100,p_offset:0,
        }),
      ])
      if(o.error||q.error)throw o.error||q.error
      setOverview((o.data||{}) as Record<string,number>)
      setAdminQuestions(arr<AdminQuestion>(q.data))
      await loadTaxonomy()
    }catch(e){setAdminError(errText(e))}finally{setAdminBusy(false)}
  },[isAdmin,trackFilter,statusFilter,adminSearch,loadTaxonomy])

  const loadContacts=useCallback(async()=>{
    if(!supabase||!isAdmin)return
    setAdminBusy(true);setAdminError('')
    try{const {data,error}=await supabase.rpc('admin_list_contact_requests',{p_status:'eligible'});if(error)throw error;setContacts(arr<ContactRow>(data))}
    catch(e){setAdminError(errText(e))}finally{setAdminBusy(false)}
  },[isAdmin])

  const loadGuardians=useCallback(async()=>{
    if(!supabase||!isAdmin)return
    setAdminBusy(true);setAdminError('')
    try{const {data,error}=await supabase.rpc('admin_list_guardian_review');if(error)throw error;setGuardians(arr<GuardianRow>(data))}
    catch(e){setAdminError(errText(e))}finally{setAdminBusy(false)}
  },[isAdmin])

  useEffect(()=>{
    if(screen!=='admin'||!isAdmin)return
    if(adminTab==='overview'||adminTab==='questions')void loadAdmin()
    if(adminTab==='contacts')void loadContacts()
    if(adminTab==='guardians')void loadGuardians()
    if(adminTab==='editor'&&classes.length===0)void loadTaxonomy().catch(e=>setAdminError(errText(e)))
  },[screen,isAdmin,adminTab,loadAdmin,loadContacts,loadGuardians,loadTaxonomy,classes.length])

  const submitAuth=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setAuthError('');setAuthMessage('')
    if(!supabase||!isSupabaseConfigured){setAuthError('Supabase is not configured in this deployment.');return}
    if(authMode==='signup'&&ageGroup==='under_18'&&!guardianConsent){setAuthError('A parent or legal guardian must confirm this registration.');return}
    setAuthBusy(true)
    try{
      if(authMode==='signup'){
        const metadata=ageGroup==='under_18'
          ? {display_name:fullName.trim(),age_group:'under_18',guardian_name:guardianName.trim(),guardian_email:accountEmail.trim(),guardian_phone:guardianPhone.trim(),guardian_consent:true,marketing_opt_in:false,marketing_channels:[]}
          : {display_name:fullName.trim(),age_group:'18_plus',contact_phone:phone.trim(),marketing_opt_in:adultMarketing,marketing_channels:adultMarketing?marketingChannels:[]}
        const {data,error}=await supabase.auth.signUp({email:accountEmail.trim(),password,options:{data:metadata,emailRedirectTo:window.location.origin}})
        if(error)throw error
        if(data.session){setSession(data.session);go('account')}
        else{setAuthMessage('Your registration has been received. Email confirmation is currently enabled in Supabase. Turn off Confirm email in Authentication settings for immediate account access. Your assigned username will appear after first sign-in.');setAuthMode('login');setScreen('login')}
      }else{
        const {data,error}=await supabase.auth.signInWithPassword({email:accountEmail.trim(),password})
        if(error)throw error
        setSession(data.session);go('account')
      }
    }catch(e){setAuthError(errText(e))}finally{setAuthBusy(false)}
  }

  const resetPassword=async()=>{
    if(!supabase||!accountEmail.trim()){setAuthError('Enter your account email first.');return}
    setAuthBusy(true);setAuthError('');setAuthMessage('')
    const {error}=await supabase.auth.resetPasswordForEmail(accountEmail.trim(),{redirectTo:window.location.origin+'/'})
    setAuthBusy(false)
    if(error)setAuthError(error.message);else setAuthMessage('If this email belongs to a SYNAPTYL account, a password reset message has been sent.')
  }

  const signOut=async()=>{
    if(!supabase)return
    setAuthBusy(true);const {error}=await supabase.auth.signOut();setAuthBusy(false)
    if(error){setAuthError(error.message);return}
    setSession(null);setProfile(null);setIsAdmin(false);go('home')
  }

  const toggleChannel=(channel:string)=>{
    setMarketingChannels(current=>current.includes(channel)?current.filter(x=>x!==channel):[...current,channel])
  }
  const saveMarketing=async(optIn:boolean)=>{
    if(!supabase)return
    setMarketingBusy(true);setMarketingMessage('')
    const {error}=await supabase.rpc('update_my_marketing_preference',{p_opt_in:optIn,p_channels:optIn?marketingChannels:[]})
    setMarketingBusy(false)
    if(error){setMarketingMessage(error.message);return}
    setProfile(current=>current?{...current,marketing_opt_in:optIn,marketing_channels:optIn?marketingChannels:[]}:current)
    setMarketingMessage(optIn?'Your optional adult update preference was saved.':'You have been removed from promotional contact.')
  }

  const openStudy=async(track:Track)=>{
    if(!session){openAuth('login');return}
    if(!isAdmin&&profile?.age_group==='under_18'&&profile.guardian_consent_status!=='verified'){go('account');return}
    setStudyTrack(track);setStudyClass('');setStudySubject('');setStudyTopic('');setQuestions([]);setPracticeSession(null);setAnswerResult(null);setStudyError('')
    go('study')
    try{await loadTaxonomy()}catch(e){setStudyError(errText(e))}
  }
  const currentQuestion=questions[questionIndex]

  const loadTopic=async(topicId:string)=>{
    if(!supabase||!session)return
    setStudyTopic(topicId);setStudyBusy(true);setStudyError('');setQuestions([]);setPracticeSession(null);setQuestionIndex(0);setAnswerResult(null)
    try{
      const [sessionRes,qRes]=await Promise.all([
        supabase.from('practice_sessions').insert({track:studyTrack,session_type:'practice'}).select('id').single(),
        supabase.from('questions').select('id,prompt,question_type,difficulty,marks,negative_marks,question_options(id,option_text,sort_order)').eq('topic_id',topicId).eq('status','published').order('created_at'),
      ])
      if(sessionRes.error||qRes.error)throw sessionRes.error||qRes.error
      setPracticeSession(sessionRes.data.id)
      setQuestions(arr<Question>(qRes.data).map(q=>({...q,question_options:[...(q.question_options||[])].sort((a,b)=>a.sort_order-b.sort_order)})))
    }catch(e){setStudyError(errText(e))}finally{setStudyBusy(false)}
  }

  const submitAnswer=async()=>{
    if(!supabase||!currentQuestion||!practiceSession)return
    const answer=currentQuestion.question_type==='mcq'?{option_id:chosenOption}:{value:answerText.trim()}
    if(currentQuestion.question_type==='mcq'&&!chosenOption){setStudyError('Choose an option first.');return}
    if(currentQuestion.question_type!=='mcq'&&!answerText.trim()){setStudyError('Enter your answer first.');return}
    setAnswerBusy(true);setStudyError('')
    try{
      const {data,error}=await supabase.rpc('submit_question_answer',{p_session_id:practiceSession,p_question_id:currentQuestion.id,p_answer:answer})
      if(error)throw error
      setAnswerResult(data as PracticeResult)
    }catch(e){setStudyError(errText(e))}finally{setAnswerBusy(false)}
  }
  const nextQuestion=()=>{
    setQuestionIndex(i=>Math.min(i+1,questions.length-1));setChosenOption('');setAnswerText('');setAnswerResult(null);setBookmarked(false)
  }
  const toggleBookmark=async()=>{
    if(!supabase||!currentQuestion)return
    if(!bookmarked){
      const {error}=await supabase.from('bookmarks').insert({question_id:currentQuestion.id})
      if(error&&!error.message.toLowerCase().includes('duplicate'))setStudyError(error.message);else setBookmarked(true)
    }else{
      const {error}=await supabase.from('bookmarks').delete().eq('question_id',currentQuestion.id)
      if(error)setStudyError(error.message);else setBookmarked(false)
    }
  }

  const saveQuestion=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(!supabase)return
    setEditorBusy(true);setEditorMessage('')
    try{
      const accepted=editor.accepted_answers.split('\n').map(x=>x.trim()).filter(Boolean)
      const payload={
        id:editor.id,subject_id:editor.subject_id,topic_id:editor.topic_id,question_type:editor.question_type,
        prompt:editor.prompt.trim(),difficulty:editor.difficulty,status:editor.status,
        marks:Number(editor.marks),negative_marks:Number(editor.negative_marks),language_code:'en',
        options:editor.question_type==='mcq'?editor.options.map(text=>({text:text.trim()})):[],
        correct_option_index:editor.question_type==='mcq'?editor.correct_option_index:null,
        accepted_answers:editor.question_type==='numerical'?accepted:[],explanation:editor.explanation,
        exam_category_ids:editor.exam_category_ids,
      }
      const {data,error}=await supabase.rpc('admin_save_question',{p_payload:payload})
      if(error)throw error
      setEditorMessage('Question saved successfully. Status: '+String((data as {status?:string})?.status||editor.status)+'.')
      setAdminTab('questions');await loadAdmin()
    }catch(e){setEditorMessage(errText(e))}finally{setEditorBusy(false)}
  }
  const archiveQuestion=async(id:string)=>{
    if(!supabase||!window.confirm('Archive this question? It will no longer appear in learner practice.'))return
    const {error}=await supabase.rpc('admin_archive_question',{p_question_id:id})
    if(error)setAdminError(error.message);else await loadAdmin()
  }
  const verifyGuardian=async(row:GuardianRow,verified:boolean)=>{
    if(!supabase)return
    const note=(guardianNotes[row.user_id]||'').trim()
    if(verified&&!note){setAdminError('Enter how guardian consent was independently verified.');return}
    setAdminBusy(true);setAdminError('')
    try{
      const {error}=await supabase.rpc('admin_set_guardian_consent',{p_user_id:row.user_id,p_verified:verified,p_note:note||'Verification rejected by administrator'})
      if(error)throw error
      setGuardianNotes(current=>({...current,[row.user_id]:''}))
      const {data}=await supabase.rpc('admin_list_guardian_review')
      setGuardians(arr<GuardianRow>(data))
      await loadAdmin()
    }catch(e){setAdminError(errText(e))}finally{setAdminBusy(false)}
  }

  if(!authReady||(session&&profileLoading))return <main className="loading-page"><div className="loading-mark">S</div><p>Preparing your SYNAPTYL learning space…</p></main>

  if(screen==='login'||screen==='signup'){
    const signup=screen==='signup'
    return <main className="auth-page">
      <a className="brand auth-brand" href="/" onClick={e=>{e.preventDefault();go('home')}}><span className="brand-mark">S</span><span>SYNAPTYL</span></a>
      <section className="auth-card auth-card-wide">
        <div className="eyebrow">{signup?'A FRESH START FOR LEARNING':'WELCOME BACK'}</div>
        <h1>{signup?'Create your account.':'Sign in to learn.'}</h1>
        <p className="auth-intro">{signup?'Join a free learning space for K–12 and GK & GS practice.':'Continue your practice and keep track of your progress.'}</p>
        {!isSupabaseConfigured&&<div className="auth-alert">Supabase is not configured in this deployment. Check Cloudflare production variables.</div>}
        <form className="auth-form" onSubmit={submitAuth}>
          {signup&&<>
            <label>Student / learner name<input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Enter full name" required maxLength={80} autoComplete="name"/></label>
            <label>Account type<select value={ageGroup} onChange={e=>setAgeGroup(e.target.value as '18_plus'|'under_18')}><option value="18_plus">I am 18 or older</option><option value="under_18">Learner under 18 — parent / guardian registering</option></select></label>
            {ageGroup==='18_plus'?<>
              <label>Email address<input type="email" value={accountEmail} onChange={e=>setAccountEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email"/></label>
              <label>Contact number<input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Your mobile number" required autoComplete="tel"/></label>
              <div className="consent-card">
                <label className="check-row"><input type="checkbox" checked={adultMarketing} onChange={e=>setAdultMarketing(e.target.checked)}/><span><b>Optional updates for adults</b><small>I agree to receive occasional SYNAPTYL product announcements and learning-resource updates. This is optional and I can withdraw at any time.</small></span></label>
                {adultMarketing&&<div className="channel-picks">{['email','sms','whatsapp'].map(ch=><label className="check-chip" key={ch}><input type="checkbox" checked={marketingChannels.includes(ch)} onChange={()=>toggleChannel(ch)}/>{ch.toUpperCase()}</label>)}</div>}
              </div>
            </>:<>
              <div className="notice-card"><b>Parent / guardian registration</b><p>The adult's email and mobile number become the account contacts. The parent or legal guardian creates the password and confirms registration. Learner access remains pending until permission is independently verified.</p></div>
              <label>Parent / legal guardian full name<input value={guardianName} onChange={e=>setGuardianName(e.target.value)} placeholder="Parent or guardian name" required maxLength={80}/></label>
              <label>Parent / guardian email (login email)<input type="email" value={accountEmail} onChange={e=>setAccountEmail(e.target.value)} placeholder="parent@example.com" required autoComplete="email"/></label>
              <label>Parent / guardian contact number<input type="tel" value={guardianPhone} onChange={e=>setGuardianPhone(e.target.value)} placeholder="Parent / guardian mobile number" required autoComplete="tel"/></label>
              <label className="check-row guardian-check"><input type="checkbox" checked={guardianConsent} onChange={e=>setGuardianConsent(e.target.checked)} required/><span>I am the parent or legal guardian and request this learner account. I understand permission will be independently reviewed before access is enabled.</span></label>
              <div className="privacy-note">Guardian details are for account and learner-safety communication, not advertising. Under-18 accounts are not added to promotional contact lists.</div>
            </>}
          </>}
          {!signup&&<label>Account email<input type="email" value={accountEmail} onChange={e=>setAccountEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email"/></label>}
          <label>{signup?'Create password':'Password'}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} required autoComplete={signup?'new-password':'current-password'}/></label>
          {authError&&<div className="auth-alert error" role="alert">{authError}</div>}
          {authMessage&&<div className="auth-alert success" role="status">{authMessage}</div>}
          <button className="button primary auth-submit" type="submit" disabled={authBusy||!isSupabaseConfigured||(signup&&ageGroup==='under_18'&&!guardianConsent)}>{authBusy?'Please wait…':signup?'Create free account':'Sign in'} <span>→</span></button>
        </form>
        {!signup&&<button className="forgot-link" type="button" disabled={authBusy} onClick={resetPassword}>Forgot password?</button>}
        <p className="auth-switch">{signup?'Already registered?':'New to SYNAPTYL?'} <button type="button" onClick={()=>openAuth(signup?'login':'signup')}>{signup?'Sign in':'Create an account'}</button></p>
        <button className="back-home" type="button" onClick={()=>go('home')}>← Back to homepage</button>
      </section>
      <p className="auth-footnote">SYNAPTYL · Practice. Progress. Master.</p>
    </main>
  }

  if(screen==='admin'){
    if(!isAdmin)return <main className="auth-page"><section className="auth-card"><div className="eyebrow">RESTRICTED AREA</div><h1>Admin access only.</h1><p className="auth-intro">This account does not have the SYNAPTYL super-admin role.</p><button className="button primary" onClick={()=>go('account')}>Return to account</button></section></main>
    const tabs:[AdminTab,string,string][]=[['overview','▦','Overview'],['questions','▤','Question bank'],['editor','＋','Add question'],['contacts','◎','Adult opt-ins'],['guardians','⌁','Guardian review']]
    return <main className="admin-shell">
      <aside className="admin-sidebar"><a className="brand" href="/" onClick={e=>{e.preventDefault();go('home')}}><span className="brand-mark">S</span><span>SYNAPTYL</span></a><div className="admin-label">SUPER ADMIN</div>
        <nav className="admin-nav">{tabs.map(([tab,icon,label])=><button key={tab} type="button" className={adminTab===tab?'active':''} onClick={()=>setAdminTab(tab)}><span>{icon}</span>{label}</button>)}</nav>
        <div className="admin-sidebar-bottom"><button type="button" onClick={()=>go('account')}>← Student view</button><button type="button" onClick={signOut}>Sign out</button></div>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar"><div><div className="eyebrow">SYNAPTYL CONTROL CENTRE</div><h1>{adminTab==='overview'?'Overview':adminTab==='questions'?'Question bank':adminTab==='editor'?(editor.id?'Edit question':'Create question'):adminTab==='contacts'?'Adult marketing opt-ins':'Guardian verification'}</h1></div><div className="admin-user"><span className="admin-avatar">A</span><div><b>Super Admin</b><small>{profile?.username||session?.user.email}</small></div></div></header>
        {adminError&&<div className="admin-error">{adminError}<button type="button" onClick={()=>setAdminError('')}>Dismiss</button></div>}
        {adminBusy&&<div className="admin-loading">Updating workspace…</div>}
        {adminTab==='overview'&&<div className="admin-content">
          <div className="admin-welcome"><div><small>YOUR PLATFORM AT A GLANCE</small><h2>Build a better learning experience.</h2><p>Manage both SYNAPTYL learning tracks from one place.</p></div><button className="button primary" type="button" onClick={()=>{setEditor({...emptyEditor,class_id:classes[0]?.id||''});setAdminTab('editor')}}>＋ Add a question</button></div>
          <div className="stat-grid">{[['Total learners',overview.total_users??0,'Registered accounts'],['Total questions',overview.total_questions??0,'Across both tracks'],['Published',overview.published_questions??0,'Visible to eligible learners'],['Drafts',overview.draft_questions??0,'Awaiting review']].map(([label,value,sub])=><div className="stat-card" key={String(label)}><small>{label}</small><strong>{Number(value).toLocaleString()}</strong><span>{sub}</span></div>)}</div>
          <div className="admin-split-grid">
            <div className="admin-panel"><div className="panel-heading"><div><small>LEARNING TRACKS</small><h3>Content coverage</h3></div></div><div className="track-count"><div><span className="track-dot purple-dot"/><b>K–12 questions</b></div><strong>{overview.k12_questions??0}</strong></div><div className="track-count"><div><span className="track-dot green-dot"/><b>GK &amp; GS questions</b></div><strong>{overview.gkgs_questions??0}</strong></div><div className="track-count"><div><span className="track-dot grey-dot"/><b>Archived</b></div><strong>{overview.archived_questions??0}</strong></div></div>
            <div className="admin-panel"><div className="panel-heading"><div><small>ACCOUNT SAFETY</small><h3>Consent review</h3></div></div><div className="track-count"><div><span className="track-dot amber-dot"/><b>Guardian checks pending</b></div><strong>{overview.guardian_verification_pending??0}</strong></div><div className="track-count"><div><span className="track-dot green-dot"/><b>Adult marketing opt-ins</b></div><strong>{overview.adult_marketing_opt_ins??overview.marketing_opt_ins??0}</strong></div><p className="panel-footnote">Promotional contacts are restricted to adults who explicitly opted in. Under-18 contacts are not included in the marketing list.</p><button className="text-action" type="button" onClick={()=>setAdminTab('guardians')}>Review guardian requests →</button></div>
          </div>
          <div className="admin-panel quick-panel"><div><small>QUICK ACTIONS</small><h3>What would you like to do?</h3></div><div className="quick-actions"><button type="button" onClick={()=>{setEditor({...emptyEditor,class_id:classes[0]?.id||''});setAdminTab('editor')}}><b>＋</b><span><strong>Add a question</strong><small>Create MCQ, written or numerical</small></span></button><button type="button" onClick={()=>setAdminTab('questions')}><b>▤</b><span><strong>Manage question bank</strong><small>Edit, publish or archive content</small></span></button><button type="button" onClick={()=>setAdminTab('contacts')}><b>◎</b><span><strong>Adult opt-ins</strong><small>Review explicit promotional consent</small></span></button></div></div>
        </div>}
        {adminTab==='questions'&&<div className="admin-content"><div className="table-toolbar"><div><h2>Question library</h2><p>Search and manage K–12 and GK &amp; GS content.</p></div><button className="button primary" type="button" onClick={()=>{setEditor({...emptyEditor,class_id:classes[0]?.id||''});setAdminTab('editor')}}>＋ Create question</button></div>
          <div className="filter-bar"><input value={adminSearch} onChange={e=>setAdminSearch(e.target.value)} placeholder="Search question, subject or topic…"/><select value={trackFilter} onChange={e=>setTrackFilter(e.target.value as 'all'|Track)}><option value="all">All tracks</option><option value="k12">K–12</option><option value="gk_gs">GK &amp; GS</option></select><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select><button className="button secondary" type="button" onClick={loadAdmin}>Apply</button></div>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Question</th><th>Track</th><th>Type</th><th>Difficulty</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {adminQuestions.map(q=><tr key={q.id}><td><b>{q.prompt.length>105?q.prompt.slice(0,105)+'…':q.prompt}</b><small>{q.subject_name} · {q.topic_name}{q.class_number?' · Class '+q.class_number:''}</small></td><td><span className={'track-pill '+q.track}>{q.track==='k12'?'K–12':'GK & GS'}</span></td><td>{q.question_type.toUpperCase()}</td><td>{q.difficulty}</td><td><span className={'status-pill '+q.status}>{q.status}</span></td><td><div className="row-actions"><button type="button" onClick={()=>{const opts=(q.options||[]).map(o=>o.text||o.option_text||'');setEditor({id:q.id,track:q.track,class_id:q.track==='k12'?(classes.find(c=>c.class_number===q.class_number)?.id||''):'',subject_id:q.subject_id,topic_id:q.topic_id,question_type:q.question_type,prompt:q.prompt,difficulty:q.difficulty,status:q.status==='published'?'published':'draft',marks:String(q.marks??1),negative_marks:String(q.negative_marks??0),options:opts.length?opts:['','','',''],correct_option_index:Math.max(0,(q.options||[]).findIndex(o=>o.id===q.correct_option_id)),accepted_answers:(q.accepted_answers||[]).join('\n'),explanation:q.explanation||'',exam_category_ids:q.exam_category_ids||[]});setAdminTab('editor')}}>Edit</button>{q.status!=='archived'&&<button type="button" className="danger-link" onClick={()=>archiveQuestion(q.id)}>Archive</button>}</div></td></tr>)}
            {adminQuestions.length===0&&<tr><td colSpan={6} className="empty-cell">No matching questions yet. Create your first question.</td></tr>}
          </tbody></table></div><p className="table-footnote">Answer keys and grading rules stay in the protected database schema and are managed through admin-only functions.</p>
        </div>}
        {adminTab==='editor'&&<div className="admin-content"><div className="table-toolbar"><div><h2>{editor.id?'Edit question':'Create a question'}</h2><p>Build content for both learning tracks.</p></div><button className="button secondary" type="button" onClick={()=>setAdminTab('questions')}>← Question bank</button></div>
          <form className="question-editor" onSubmit={saveQuestion}>
            <div className="editor-section"><div className="editor-heading"><span>01</span><div><h3>Learning location</h3><p>Choose where this question belongs.</p></div></div><div className="editor-fields">
              <label>Learning track<select value={editor.track} onChange={e=>setEditor({...editor,track:e.target.value as Track,class_id:'',subject_id:'',topic_id:''})}><option value="k12">K–12 school learning</option><option value="gk_gs">GK &amp; GS competitive exams</option></select></label>
              {editor.track==='k12'&&<label>Class<select required value={editor.class_id} onChange={e=>setEditor({...editor,class_id:e.target.value,subject_id:'',topic_id:''})}><option value="">Select class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select></label>}
              <label>Subject<select required value={editor.subject_id} onChange={e=>setEditor({...editor,subject_id:e.target.value,topic_id:''})}><option value="">Select subject</option>{subjects.filter(s=>s.track===editor.track&&(editor.track==='gk_gs'||s.school_class_id===editor.class_id)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label>Topic<select required value={editor.topic_id} onChange={e=>setEditor({...editor,topic_id:e.target.value})}><option value="">Select topic</option>{topics.filter(t=>t.subject_id===editor.subject_id).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            </div>
            {editor.track==='gk_gs'&&<div className="exam-tags-editor"><small>ASSOCIATE EXAM CATEGORIES</small><div>{examCategories.map(x=><label className="check-chip" key={x.id}><input type="checkbox" checked={editor.exam_category_ids.includes(x.id)} onChange={e=>setEditor({...editor,exam_category_ids:e.target.checked?[...editor.exam_category_ids,x.id]:editor.exam_category_ids.filter(id=>id!==x.id)})}/>{x.name}</label>)}</div></div>}</div>
            <div className="editor-section"><div className="editor-heading"><span>02</span><div><h3>Question content</h3><p>Write the prompt and select response type.</p></div></div><div className="editor-fields"><label>Question type<select value={editor.question_type} onChange={e=>setEditor({...editor,question_type:e.target.value as EditorState['question_type']})}><option value="mcq">Multiple choice (MCQ)</option><option value="written">Written answer</option><option value="numerical">Numerical answer</option></select></label><label>Difficulty<select value={editor.difficulty} onChange={e=>setEditor({...editor,difficulty:e.target.value})}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label></div>
              <label className="full-field">Question / prompt<textarea rows={4} required value={editor.prompt} onChange={e=>setEditor({...editor,prompt:e.target.value})} placeholder="Write the complete question…"/></label>
              {editor.question_type==='mcq'?<div className="options-editor"><div className="inline-heading"><b>Answer options</b><small>Select the correct option.</small></div>{editor.options.map((opt,i)=><div className="option-editor-row" key={i}><label className="correct-radio"><input type="radio" name="correct-option" checked={editor.correct_option_index===i} onChange={()=>setEditor({...editor,correct_option_index:i})}/><span>{String.fromCharCode(65+i)}</span></label><input value={opt} required placeholder={'Option '+String.fromCharCode(65+i)} onChange={e=>setEditor({...editor,options:editor.options.map((x,j)=>i===j?e.target.value:x)})}/>{editor.options.length>2&&<button type="button" onClick={()=>setEditor({...editor,options:editor.options.filter((_,j)=>j!==i),correct_option_index:0})}>×</button>}</div>)}<button type="button" className="add-option" onClick={()=>setEditor({...editor,options:[...editor.options,'']})}>＋ Add another option</button></div>
              :editor.question_type==='numerical'?<label className="full-field">Accepted numerical answers (one per line)<textarea rows={3} value={editor.accepted_answers} onChange={e=>setEditor({...editor,accepted_answers:e.target.value})} placeholder={'42\n42.0'}/></label>
              :<div className="notice-card">Written answers are stored for review. Automatic keyword grading is not enabled.</div>}</div>
            <div className="editor-section"><div className="editor-heading"><span>03</span><div><h3>Marks &amp; explanation</h3><p>Set the marking scheme and feedback.</p></div></div><div className="editor-fields"><label>Marks<input type="number" min="0" step="0.25" value={editor.marks} onChange={e=>setEditor({...editor,marks:e.target.value})}/></label><label>Negative marks<input type="number" min="0" step="0.25" value={editor.negative_marks} onChange={e=>setEditor({...editor,negative_marks:e.target.value})}/></label></div><label className="full-field">Explanation / solution<textarea rows={4} value={editor.explanation} onChange={e=>setEditor({...editor,explanation:e.target.value})} placeholder="Explain the reasoning step by step…"/></label></div>
            <div className="editor-section editor-publish"><div><h3>Publishing</h3><p>Drafts are admin-only. Published questions appear in learner practice.</p></div><label>Status<select value={editor.status} onChange={e=>setEditor({...editor,status:e.target.value as 'draft'|'published'})}><option value="draft">Save as draft</option><option value="published">Publish question</option></select></label></div>
            {editorMessage&&<div className={editorMessage.includes('successfully')?'auth-alert success':'auth-alert error'}>{editorMessage}</div>}
            <div className="editor-actions"><button type="button" className="button secondary" onClick={()=>setAdminTab('questions')}>Cancel</button><button type="submit" className="button primary" disabled={editorBusy||!editor.subject_id||!editor.topic_id}>{editorBusy?'Saving…':editor.id?'Save changes':editor.status==='published'?'Publish question':'Save draft'} →</button></div>
          </form>
        </div>}
        {adminTab==='contacts'&&<div className="admin-content"><div className="table-toolbar"><div><h2>Adult promotional opt-ins</h2><p>Only adult account holders who explicitly opted in appear here.</p></div><span className="privacy-badge">CONSENT REQUIRED</span></div><div className="notice-card"><b>Use these contacts responsibly.</b><p>This list excludes under-18 learners and guardian contacts. Contact adults only for the channels and purpose they selected. Honour withdrawals promptly. This screen does not provide bulk advertising export.</p></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Account holder</th><th>Contact</th><th>Channels</th><th>Consent date</th></tr></thead><tbody>{contacts.map(c=><tr key={c.user_id}><td><b>{c.display_name||c.username}</b><small>{c.username}</small></td><td>{c.email}<small>{c.contact_phone||'No phone number'}</small></td><td><div className="channel-list">{c.marketing_channels.map(ch=><span key={ch}>{ch}</span>)}</div></td><td>{dateText(c.marketing_opt_in_at)}</td></tr>)}{contacts.length===0&&<tr><td colSpan={4} className="empty-cell">No adult promotional opt-ins recorded yet.</td></tr>}</tbody></table></div></div>}
        {adminTab==='guardians'&&<div className="admin-content"><div className="table-toolbar"><div><h2>Guardian verification</h2><p>Verify parent / guardian permission before enabling under-18 learner access.</p></div><span className="privacy-badge amber-badge">LEARNING ACCESS PENDING</span></div><div className="notice-card"><b>Verification is not a checkbox.</b><p>Independently confirm the person is the learner's parent or legal guardian, record how verification was completed, and only then approve. This is an account-safeguarding workflow, not a promotional contact list.</p></div><div className="guardian-list">{guardians.map(row=><article className="guardian-card" key={row.user_id}><div className="guardian-card-head"><div><b>{row.display_name}</b><small>{row.username} · Registered {dateText(row.created_at)}</small></div><span className="status-pill pending">Pending</span></div><div className="guardian-details"><div><small>GUARDIAN</small><b>{row.guardian_name||'Not supplied'}</b></div><div><small>EMAIL</small><b>{row.guardian_email||'Not supplied'}</b></div><div><small>PHONE</small><b>{row.guardian_phone||'Not supplied'}</b></div></div><label className="full-field">Verification note<textarea rows={2} value={guardianNotes[row.user_id]||''} onChange={e=>setGuardianNotes({...guardianNotes,[row.user_id]:e.target.value})} placeholder="Record the independent verification method and date…"/></label><div className="row-actions"><button type="button" className="button primary" onClick={()=>verifyGuardian(row,true)}>Verify guardian &amp; enable learning</button><button type="button" className="button secondary danger-button" onClick={()=>verifyGuardian(row,false)}>Reject request</button></div></article>)}{guardians.length===0&&<div className="empty-state"><b>No pending guardian requests.</b><p>New under-18 registrations requiring review appear here.</p></div>}</div></div>}
      </section>
    </main>
  }

  if(screen==='account'){
    const display=profile?.display_name||session?.user.email||'Learner'
    const guardianPending=profile?.age_group==='under_18'&&profile.guardian_consent_status!=='verified'
    return <main className="account-page"><header className="site-header account-header"><a className="brand" href="/" onClick={e=>{e.preventDefault();go('home')}}><span className="brand-mark">S</span><span>SYNAPTYL</span></a><div className="account-header-actions">{isAdmin&&<button className="header-admin" type="button" onClick={()=>{setAdminTab('overview');go('admin')}}>Admin console ↗</button>}<button className="header-link" type="button" onClick={signOut}>Sign out</button></div></header>
      <section className="account-content"><div className="eyebrow">YOUR LEARNING SPACE</div><h1>Welcome, <em>{display}</em>.</h1><p className="hero-description">Your SYNAPTYL account is ready. Choose a learning area to continue.</p>
        <div className="student-identity"><div className="student-avatar">{display.slice(0,1).toUpperCase()}</div><div><small>YOUR ASSIGNED USERNAME</small><b>{profile?.username||'Preparing username…'}</b><span>{session?.user.email}</span></div><span className="free-pill">FREE ACCOUNT</span></div>
        {guardianPending?<div className="guardian-pending"><div className="pending-icon">!</div><div><b>Guardian verification is pending</b><p>Learning access for this under-18 account is held until a parent or legal guardian is independently verified. Guardian contact details are used for account-safety communication, not promotional advertising.</p></div></div>
        :<div className="account-paths"><button type="button" className="account-path-card" onClick={()=>openStudy('k12')}><span className="path-icon">✳</span><small>SCHOOL LEARNING</small><h2>K–12</h2><p>Explore class-wise learning from Primary to Senior Secondary.</p><b>Explore K–12 →</b></button><button type="button" className="account-path-card" onClick={()=>openStudy('gk_gs')}><span className="path-icon">⌁</span><small>COMPETITIVE EXAMS</small><h2>GK &amp; GS</h2><p>Practise General Knowledge and General Studies topic by topic.</p><b>Explore GK &amp; GS →</b></button></div>}
        {profile?.age_group==='18_plus'&&<div className="account-settings-card"><div><small>COMMUNICATION PREFERENCES</small><h3>Optional adult updates</h3><p>Choose whether SYNAPTYL may send occasional product announcements and learning-resource updates.</p></div><div className="account-consent-control"><label className="check-row"><input type="checkbox" checked={Boolean(profile.marketing_opt_in)} onChange={e=>setProfile({...profile,marketing_opt_in:e.target.checked})}/> I agree to receive optional updates.</label><div className="channel-picks">{['email','sms','whatsapp'].map(ch=><label className="check-chip" key={ch}><input type="checkbox" checked={marketingChannels.includes(ch)} onChange={()=>toggleChannel(ch)}/>{ch.toUpperCase()}</label>)}</div><div className="account-consent-actions"><button className="button secondary" type="button" disabled={marketingBusy} onClick={()=>saveMarketing(false)}>Withdraw consent</button><button className="button primary" type="button" disabled={marketingBusy} onClick={()=>saveMarketing(true)}>Save preference</button></div>{marketingMessage&&<small className="form-feedback">{marketingMessage}</small>}</div></div>}
        <div className="account-note">SYNAPTYL is free for every learner. Practice tools and question libraries are being built out by learning area.</div>{isAdmin&&<button type="button" className="admin-shortcut" onClick={()=>{setAdminTab('overview');go('admin')}}>Open Super Admin dashboard →</button>}
      </section></main>
  }

  if(screen==='study'){
    const selectedClass=classes.find(c=>c.id===studyClass)
    const selectedSubject=subjects.find(s=>s.id===studySubject)
    const current=questions[questionIndex]
    const visibleSubjects=subjects.filter(s=>s.track===studyTrack&&(studyTrack==='gk_gs'||s.school_class_id===studyClass))
    const visibleTopics=topics.filter(t=>t.subject_id===studySubject)
    return <main className="study-page"><header className="site-header account-header"><a className="brand" href="/" onClick={e=>{e.preventDefault();go('home')}}><span className="brand-mark">S</span><span>SYNAPTYL</span></a><div className="account-header-actions"><button className="header-link" type="button" onClick={()=>go('account')}>My learning</button><button className="header-link" type="button" onClick={signOut}>Sign out</button></div></header>
      <section className="study-content"><button className="back-link" type="button" onClick={()=>go('account')}>← Back to learning space</button><div className="eyebrow">{studyTrack==='k12'?'SCHOOL LEARNING':'COMPETITIVE EXAM PREPARATION'}</div><h1>{studyTrack==='k12'?'K–12 practice.':'GK & GS practice.'}</h1><p className="study-intro">Choose a class or topic to find published questions and start practising.</p>
        <div className="study-selectors">{studyTrack==='k12'&&<label>Class<select value={studyClass} onChange={e=>{setStudyClass(e.target.value);setStudySubject('');setStudyTopic('');setQuestions([])}}><option value="">Select class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select></label>}<label>Subject<select value={studySubject} disabled={studyTrack==='k12'&&!studyClass} onChange={e=>{setStudySubject(e.target.value);setStudyTopic('');setQuestions([])}}><option value="">Select subject</option>{visibleSubjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Topic<select value={studyTopic} disabled={!studySubject} onChange={e=>loadTopic(e.target.value)}><option value="">Select topic</option>{visibleTopics.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div>
        <div className="selected-path">{selectedClass?.display_name||''}{selectedSubject?' / '+selectedSubject.name:''}</div>
        {studyError&&<div className="auth-alert error">{studyError}</div>}{studyBusy&&<div className="empty-state">Loading practice questions…</div>}
        {!studyTopic&&!studyBusy&&<div className="study-empty"><div className="empty-illustration">✳</div><h2>Choose where to begin.</h2><p>Select a class or learning area, then pick a topic to see available questions.</p></div>}
        {studyTopic&&!studyBusy&&questions.length===0&&!studyError&&<div className="study-empty"><h2>Questions coming soon.</h2><p>This topic has not been populated yet.</p></div>}
        {current&&<section className="practice-card"><div className="practice-topline"><span>QUESTION {questionIndex+1} OF {questions.length}</span><span>{current.difficulty.toUpperCase()}</span></div><div className="practice-progress"><span style={{width:((questionIndex+1)/questions.length*100)+'%'}}/></div><div className="practice-meta"><span>{current.question_type.toUpperCase()}</span><span>{current.marks} mark{current.marks===1?'':'s'}</span></div><h2>{current.prompt}</h2>
          {current.question_type==='mcq'?<div className="practice-options">{current.question_options.map((opt,i)=><button key={opt.id} type="button" disabled={Boolean(answerResult)} className={'practice-option '+(chosenOption===opt.id?'selected':'')+(answerResult?.correct_option_id===opt.id?' right-answer':'')} onClick={()=>setChosenOption(opt.id)}><span>{String.fromCharCode(65+i)}</span>{opt.option_text||opt.text}</button>)}</div>:<label className="practice-answer-label">{current.question_type==='numerical'?'Your numerical answer':'Your written answer'}<textarea rows={current.question_type==='written'?5:2} value={answerText} disabled={Boolean(answerResult)} onChange={e=>setAnswerText(e.target.value)} placeholder="Type your answer here…"/></label>}
          {answerResult&&<div className={'answer-feedback '+(answerResult.status==='correct'?'correct':answerResult.status==='incorrect'?'incorrect':'review')}><b>{answerResult.status==='correct'?'Correct answer!':answerResult.status==='incorrect'?'Not quite. Review the explanation.':'Answer submitted for review.'}</b>{answerResult.marks_awarded!==null&&<span>Marks awarded: {answerResult.marks_awarded}</span>}{answerResult.explanation&&<p>{answerResult.explanation}</p>}{answerResult.status==='submitted_for_review'&&<p>Your written answer has been saved. Written answers are not automatically graded.</p>}</div>}
          <div className="practice-actions"><button type="button" className="bookmark-button" disabled={!answerResult} onClick={toggleBookmark}>☆ {bookmarked?'Saved':'Save question'}</button>{!answerResult?<button type="button" className="button primary" onClick={submitAnswer} disabled={answerBusy}>{answerBusy?'Checking…':'Submit answer →'}</button>:<button type="button" className="button primary" onClick={nextQuestion} disabled={questionIndex>=questions.length-1}>{questionIndex>=questions.length-1?'Topic completed':'Next question →'}</button>}</div>
        </section>}
      </section></main>
  }

  return <main>
    <header className="site-header"><a className="brand" href="#home"><span className="brand-mark">S</span><span>SYNAPTYL</span></a><nav aria-label="Main navigation"><a href="#k12">K–12</a><a href="#gk-gs">GK &amp; GS</a><a href="#how-it-works">How it works</a><a href="#about">About</a></nav>
      {session?<div className="header-auth-actions">{isAdmin&&<button className="header-admin" type="button" onClick={()=>{setAdminTab('overview');go('admin')}}>Admin</button>}<button className="header-signup" type="button" onClick={()=>go('account')}>My learning ↗</button></div>:<div className="header-auth-actions"><button className="header-login" type="button" onClick={()=>openAuth('login')}>Sign in</button><button className="header-signup" type="button" onClick={()=>openAuth('signup')}>Join free <span>↗</span></button></div>}
    </header>
    <section className="hero" id="home"><div className="hero-copy"><div className="eyebrow"><i/> OPEN LEARNING. ZERO COST.</div><h1>Learn more.<br/><em>Move forward.</em></h1><p className="hero-description">A free place to practise, learn and grow. Choose school learning for Classes 1–12 or GK &amp; GS practice for competitive examinations.</p><div className="hero-actions"><button className="button primary" type="button" onClick={()=>session?go('account'):openAuth('signup')}>Start learning <span>→</span></button><a className="button secondary" href="#how-it-works">How it works</a></div><div className="hero-note"><b>✓</b> Free for every learner. No premium walls.</div></div>
      <div className="hero-art" aria-label="Illustration of a learning progress dashboard"><div className="orbit orbit-a"/><div className="orbit orbit-b"/><div className="dashboard"><div className="dash-top"><small>YOUR LEARNING SPACE</small><i/></div><h2>Progress, not pressure.</h2><div className="progress-label"><span>Today’s practice</span><b>Keep going</b></div><div className="progress"><span/></div><div className="tiles"><div className="tile lavender"><strong>✳</strong><small>LEARN</small><b>Understand</b></div><div className="tile mint"><strong>↗</strong><small>PRACTISE</small><b>Strengthen</b></div><div className="tile peach"><strong>◎</strong><small>REVIEW</small><b>Remember</b></div><div className="tile blue"><strong>✦</strong><small>GROW</small><b>Improve</b></div></div><div className="dash-foot">✦ <span>Every question is a chance to grow.</span></div></div><div className="float-note left-note">✦ &nbsp; One question at a time</div><div className="float-note right-note">↗ &nbsp; Your pace. Your progress.</div></div>
    </section>
    <section className="promise-strip"><div><b>01</b> Learn with clarity</div><div><b>02</b> Practise with purpose</div><div><b>03</b> Track your progress</div><div><b>04</b> Always free to use</div></section>
    <section className="section learning-section k12-section" id="k12"><div className="section-heading"><div><div className="eyebrow">01 · SCHOOL LEARNING</div><h2>Learning for<br/>every school stage.</h2></div><p>Explore class-wise practice for Classes 1–12. Build understanding, strengthen concepts and develop confidence one question at a time.</p></div><div className="school-grid">{groups.map(g=><article className="school-card" key={g.title}><div className="school-card-top"><span>{g.icon}</span><small>{g.range}</small></div><h3>{g.title}</h3><p>{g.copy}</p><button type="button" className="card-link" onClick={()=>openStudy('k12')}>Explore classes <b>↗</b></button></article>)}</div><div className="subject-band"><div><small>SUBJECTS</small><b>Learn across the curriculum</b></div><div className="topic-tags">{['Mathematics','Science','English','Social Science','Computer Science'].map(s=><span className="topic-tag" key={s}>{s}</span>)}</div></div></section>
    <section className="section learning-section gkgs-section" id="gk-gs"><div className="section-heading"><div><div className="eyebrow">02 · COMPETITIVE EXAM PREPARATION</div><h2>GK &amp; GS.<br/>One focused place.</h2></div><p>Prepare for competitive examinations with topic-wise General Knowledge and General Studies practice, revision and explanations.</p></div><div className="gkgs-grid">{gkgs.map((x,i)=><article className="gkgs-card" key={x.title}><small>0{i+1}</small><h3>{x.title}</h3><p>{x.copy}</p><button type="button" aria-label={'Explore '+x.title} onClick={()=>openStudy('gk_gs')}>↗</button></article>)}</div><div className="exam-band"><div><small>EXAM CATEGORIES</small><b>Practise for your target exam</b></div><div className="topic-tags">{['SSC','Railway','Teaching','Banking','Defence','Other competitive exams'].map(x=><span className="topic-tag" key={x}>{x}</span>)}</div></div></section>
    <section className="section how-section" id="how-it-works"><div className="eyebrow">A SIMPLE WAY TO GET BETTER</div><h2>Learn. Practise. Reflect.</h2><div className="steps">{[['01','Choose your section','Start with K–12 school learning or GK & GS for competitive exams.'],['02','Try questions','Work through questions at your own pace and learn from explanations.'],['03','See your growth','Use your practice history to spot strengths and topics to revisit.']].map(([n,t,b])=><article key={n}><small>{n}</small><h3>{t}</h3><p>{b}</p></article>)}</div></section>
    <section className="closing" id="about"><div><div className="eyebrow light">YOUR NEXT STEP STARTS HERE</div><h2>Make practice part<br/>of your progress.</h2></div><button className="button light-button" type="button" onClick={()=>session?go('account'):openAuth('signup')}>Start exploring <span>→</span></button></section>
    <footer><a className="brand" href="#home"><span className="brand-mark">S</span><span>SYNAPTYL</span></a><span>Practice. Progress. Master.</span><span>© {new Date().getFullYear()} SYNAPTYL</span></footer>
  </main>
}
