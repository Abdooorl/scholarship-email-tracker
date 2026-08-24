import { classifyEmail } from './classify.mjs';

const cases = [
  {
    name: 'scholarship acceptance (award wording)',
    email: {
      subject: 'Chevening Scholarship Decision',
      from: 'Chevening Secretariat <noreply@chevening.org>',
      body: `Dear Abdullahi,\n\nCongratulations! We are delighted to inform you that you have been awarded the Chevening Scholarship for the 2026/2027 academic year.\n\nPlease find your offer letter attached.`,
    },
    expect: { status: 'accepted', topic: 'scholarship' },
  },
  {
    name: 'scholarship rejection',
    email: {
      subject: 'Your DAAD scholarship application',
      from: 'DAAD <noreply@daad.de>',
      body: `Dear Applicant,\n\nUnfortunately, after a highly competitive review, we regret to inform you that we are unable to offer you a place in this year's scholarship programme.\n\nWe received many strong applications and thank you for applying.`,
    },
    expect: { status: 'rejected', topic: 'scholarship' },
  },
  {
    name: 'JOB rejection must NOT be classified as rejection',
    email: {
      subject: 'Update on your application - Software Engineer',
      from: 'Recruiting Team <careers@techcorp.com>',
      body: `Hi Abdullahi,\n\nThank you for your interest in the position of Software Engineer at TechCorp.\n\nUnfortunately, we will not be moving forward with your application. We had many strong candidates for the role.\n\nBest,\nRecruiter`,
    },
    expect: { status: 'other', topic: 'job' },
  },
  {
    name: 'JOB offer with congratulations must NOT be accepted',
    email: {
      subject: 'Offer of Employment',
      from: 'HR <hr@acme.io>',
      body: `Congratulations! We are pleased to inform you that you have been selected for the position of Backend Engineer at Acme. Please review the compensation package and salary details attached.`,
    },
    expect: { status: 'other', topic: 'job' },
  },
  {
    name: 'admission acceptance with funding',
    email: {
      subject: 'Offer of Admission - MSc Computer Science',
      from: 'Imperial College London <admissions@imperial.ac.uk>',
      body: `Dear Abdullahi,\n\nWe are pleased to inform you that you have been admitted to the MSc in Computing Science programme starting September 2026, together with full funding covering tuition fees and a stipend.`,
    },
    expect: { status: 'accepted', topic: 'scholarship' },
  },
  {
    name: 'newsletter / other mail stays neutral',
    email: {
      subject: 'Weekly digest: opportunities roundup',
      from: 'Newsletter <hi@opportunities.example.com>',
      body: `This week in scholarships and admissions news: deadlines approaching for several programmes you follow. Read more on our website.`,
    },
    expect: { status: 'other' },
  },
  {
    name: 'funded PhD position treated as scholarship-relevant',
    email: {
      subject: 'Fully funded PhD studentship decision',
      from: 'Uni Admissions <phd@university.edu>',
      body: `Dear candidate,\n\nI am sorry to say that your application was not successful on this occasion. The studentship was extremely competitive.\n\nRegards`,
    },
    expect: { status: 'rejected', topic: 'scholarship' },
  },
];

let failed = 0;
for (const c of cases) {
  const result = classifyEmail(c.email);
  const statusOk = result.status === c.expect.status;
  const topicOk = !c.expect.topic || result.topic === c.expect.topic;
  const pass = statusOk && topicOk;
  console.log(
    `${pass ? 'PASS' : 'FAIL'}  ${c.name}\n      -> ${result.status}/${result.topic} (matched: ${result.matched.join(', ') || '-'})`
  );
  if (!pass) failed++;
}

if (failed > 0) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log('\nAll classifier tests passed');
