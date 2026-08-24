// Scholarship-focused email classifier.
//
// Hard rule: an email is only ever marked "accepted" or "rejected" if it first
// qualifies as scholarship / academic-admission related. Job-application emails
// are always filed as topic "job" with status "other", no matter how strong the
// accept/reject wording is ("Congratulations! ... position of ..." stays "other").
//
// Tune the word lists below as you like — they are plain substring matches,
// case-insensitive, applied to subject + from + body (subject weighted 2x).

const SCHOLARSHIP_TERMS = [
  'scholarship', 'scholarships', 'bursary', 'bursaries',
  'fellowship', 'fellowships', 'studentship',
  'financial aid', 'student finance', 'tuition fee', 'tuition',
  'stipend', 'fully funded', 'full funding', 'partial funding',
  'funding offer', 'funding decision', 'offer of funding',
  'award', 'awarded', 'grantee', 'merit-based', 'need-based',
  'fee waiver', 'travel grant', 'research grant',
  // well-known programmes
  'chevening', 'fulbright', 'daad', 'erasmus', 'erasmus mundus',
  'commonwealth scholarship', 'mastercard foundation', 'mandela rhodes',
  'rhodes scholarship', 'gates cambridge', 'clarendon fund', 'vanier cgs',
  'australia awards', 'schwarzman scholars', 'knight-hennessy', 'yenching',
];

const ACADEMIC_TERMS = [
  'admission', 'admissions', 'admitted', 'offer of admission',
  'letter of acceptance', 'university offer',
  'graduate school', 'grad school', 'postgraduate', 'undergraduate',
  'graduate programme', 'graduate program',
  'msc', "master's", 'masters', 'bachelor', 'phd', 'doctoral',
  'enrolment', 'enrollment', 'place on the programme', 'place on the program',
];

const JOB_TERMS = [
  'job application', 'job offer', 'job posting', 'job alert', 'job opening',
  'open position', 'new position', 'the position of', 'for the position',
  'this position', 'role of', 'this role', 'the role at',
  'vacancy', 'vacancies', 'we are hiring', 'now hiring', 'hiring for',
  'recruiter', 'recruitment', 'talent acquisition',
  'invite you to interview', 'interview for the', 'next round interview',
  'employment', 'salary expectation', 'notice period', 'right to work',
  'workday', 'greenhouse.io', 'myworkdayjobs', 'lever.co', 'ashbyhq',
  'linkedin.com/jobs', 'indeed.com', 'glassdoor',
  'your cv', 'your resume', 'cv attached', 'cover letter',
  'join our team as', 'joining our team as',
  'compensation package', 'employee benefits', 'probation period',
];

const ACCEPT_PATTERNS = [
  'congratulation', 'congrats',
  'pleased to inform you', 'delighted to inform you', 'happy to inform you',
  'thrilled to inform you', 'excited to inform you', 'great pleasure in informing',
  'i am delighted', 'we are delighted',
  'you have been selected', 'have selected you', 'you were selected',
  'selected as a recipient', 'selected as a finalist', 'chosen as a recipient',
  'you have been awarded', 'awarded to you', 'award recipient',
  'recipient of the', 'winner of the', 'have been granted',
  'you have been admitted', 'has admitted you', 'been offered admission',
  'offer of admission', 'offer of a place', 'offer you a place', 'offer of place',
  'letter of acceptance', 'unconditional offer',
  'your acceptance to', 'accepted into', 'acceptance into',
  'successful applicant', 'successful candidate', 'successful application',
  'shortlisted', 'short-listed',
  'we would like to offer you', 'are pleased to offer',
  'scholarship offer', 'funding offer', 'an offer of funding',
  'welcome you to the',
];

const REJECT_PATTERNS = [
  'unfortunately', 'unfortunate news', 'sad news',
  'regret to inform', 'sorry to inform', 'sorry to say', 'sorry to tell',
  'we regret', 'with regret', 'saddened to inform',
  'unable to offer', 'not able to offer', "won't be able to offer",
  'will not be able to offer', 'cannot offer you', "can't offer you",
  'will not be offering', 'not in a position to offer',
  'not been selected', 'were not selected', 'was not selected',
  'not selected for', 'you have not been', 'have not been chosen',
  'not shortlisted',
  'unsuccessful', 'not been successful', 'was not successful', 'were not successful',
  'did not succeed', 'did not meet the criteria',
  'will not be moving forward', 'not moving forward with',
  'will not be proceeding', 'not be progressing',
  'highly competitive', 'many strong applications',
  'your application was not', 'declined your application', 'application declined',
  'cannot offer you admission', 'unable to admit',
];

function countTerm(haystack, term) {
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(term, idx)) !== -1) {
    count += 1;
    idx += term.length;
    if (count >= 3) break; // cap weight per term so spam can't dominate
  }
  return count;
}

function score(haystack, terms) {
  const matched = [];
  let total = 0;
  for (const term of terms) {
    const n = countTerm(haystack, term);
    if (n > 0) {
      matched.push(term);
      total += Math.min(n, 3);
    }
  }
  return { total, matched };
}

/**
 * @param {{subject?: string, from?: string, body?: string}} email
 * @returns {{status: 'accepted'|'rejected'|'other', topic: 'scholarship'|'job'|'other', matched: string[]}}
 */
export function classifyEmail({ subject = '', from = '', body = '' } = {}) {
  const haystack = [
    subject.toLowerCase(),
    subject.toLowerCase(), // subject counted twice = 2x weight
    from.toLowerCase(),
    String(body).slice(0, 40000).toLowerCase(),
  ].join('\n');

  const sch = score(haystack, [...SCHOLARSHIP_TERMS, ...ACADEMIC_TERMS]);
  const job = score(haystack, JOB_TERMS);

  // Gate: scholarship/academic mail must outweigh any job signals.
  const isScholarship = sch.total > 0 && sch.total >= job.total;

  if (!isScholarship) {
    return {
      status: 'other',
      topic: sch.total === 0 && job.total > 0 ? 'job' : 'other',
      matched: [],
    };
  }

  const acc = score(haystack, ACCEPT_PATTERNS);
  const rej = score(haystack, REJECT_PATTERNS);

  let status = 'other';
  if (acc.total > rej.total) status = 'accepted';
  else if (rej.total > acc.total) status = 'rejected';

  const matched = Array.from(
    new Set([...acc.matched.slice(0, 5), ...rej.matched.slice(0, 5)])
  ).slice(0, 10);

  return { status, topic: 'scholarship', matched };
}
