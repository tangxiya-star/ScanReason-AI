export type ViewKey = "axial" | "coronal" | "sagittal";

export const views: Record<ViewKey, { label: string; count: number; default: number }> = {
  axial:    { label: "Axial",    count: 240, default: 120 },
  coronal:  { label: "Coronal",  count: 240, default: 120 },
  sagittal: { label: "Sagittal", count: 154, default: 77  },
};

export const sliceUrl = (view: ViewKey, i: number) =>
  `/slices/${view}/slice_${String(i).padStart(3, "0")}.jpg`;

export const sampleCase = {
  patientId: "PT-MS-01",
  modality: "MRI Brain · T2 FLAIR (3D)",
  sliceRange: "see slider",
  finding: "Multifocal periventricular & juxtacortical white-matter hyperintensities",
  region: "Periventricular & juxtacortical white matter, bilateral",
  nearby: ["Lateral ventricles", "Corpus callosum", "Centrum semiovale"],
  confidence: "Medium",
  // Backwards-compat single-image fallback (used by /api/explain image embedding)
  imageUrl: sliceUrl("axial", 120),
  imageUrls: Array.from({ length: 240 }, (_, i) => sliceUrl("axial", i)) as string[],
};

export type AgentResponse = {
  title: string;
  body: string[];
  agent: string;
};

export const getObservation = (): AgentResponse => ({
  title: "Observations",
  agent: "Observation Agent",
  body: [
    "Multiple ovoid T2/FLAIR hyperintense lesions in the periventricular and juxtacortical white matter, bilateral.",
    "Several lesions oriented perpendicular to the lateral ventricles (Dawson's fingers configuration).",
    "Involvement of the corpus callosum on sagittal view; no overt mass effect or midline shift.",
  ],
});

export const getSpatial = (): AgentResponse => ({
  title: "Spatial Mapping",
  agent: "Spatial Mapping Agent",
  body: [
    "Lesions distributed across periventricular, juxtacortical, and callosal regions.",
    "Best appreciated on axial and sagittal FLAIR; coronal confirms callosal involvement.",
    "No infratentorial dominance; supratentorial burden predominates.",
  ],
});

export const getReasoning = (): AgentResponse => ({
  title: "Clinical Reasoning",
  agent: "Reasoning Agent",
  body: [
    "Spatial distribution and morphology fulfill MRI criteria for dissemination in space (DIS) — strongly suggestive of multiple sclerosis.",
    "Differential includes other demyelinating disease (NMO, ADEM), small-vessel ischemic disease, and migraine-related white-matter changes.",
    "Dissemination in time requires either new lesions on follow-up or simultaneous gadolinium-enhancing and non-enhancing lesions.",
  ],
});

export const getChecklist = (): AgentResponse => ({
  title: "What to Verify",
  agent: "Checklist Agent",
  body: [
    "Review post-contrast T1 for active (enhancing) lesions to establish dissemination in time.",
    "Inspect cervical spinal cord MRI for additional demyelinating lesions.",
    "Compare with prior imaging if available; new T2 lesions support DIT.",
    "Correlate with clinical history (relapses, optic neuritis) and CSF oligoclonal bands.",
  ],
});

export const getSafety = (): AgentResponse => ({
  title: "Uncertainty & Safety",
  agent: "Safety Agent",
  body: [
    "Confidence: Medium. Lesion pattern is characteristic but not pathognomonic for MS.",
    "Avoid premature closure — small-vessel disease can mimic MS in older patients.",
    "Recommend neurology referral and consideration of full McDonald criteria evaluation.",
  ],
});

export const getExplain = () => ({
  whatWeSee:
    "Multiple ovoid white-matter hyperintensities on FLAIR, with characteristic perpendicular orientation to the lateral ventricles ('Dawson's fingers') and involvement of the corpus callosum.",
  whyItMatters:
    "This spatial pattern is the classical MRI signature of multiple sclerosis. Early recognition matters because disease-modifying therapy is most effective when started early.",
  whatToCompare:
    "Compare with prior MRIs if available (new T2 lesions = dissemination in time), the cervical cord (frequently involved in MS), and post-contrast T1 (active enhancement).",
  commonMistake:
    "Confusing ischemic small-vessel disease for MS. Vascular lesions tend to spare the corpus callosum, the U-fibers (juxtacortical), and lack ovoid morphology — distribution is the discriminator.",
  reportWording:
    "Multifocal ovoid T2/FLAIR hyperintensities in periventricular, juxtacortical, and callosal white matter, with several lesions oriented perpendicular to the ventricular margin. Findings fulfill MRI criteria for dissemination in space; the distribution is most consistent with demyelinating disease (multiple sclerosis). Clinical and post-contrast/spinal correlation recommended.",
});

export const getFollowUp = (q: string) => ({
  question: q,
  answer:
    "The most informative next step is a post-contrast T1 sequence: simultaneous enhancing and non-enhancing lesions establish dissemination in time and would satisfy the 2017 McDonald criteria from a single MRI. Cervical spine imaging is the second-highest yield investigation.",
  agent: "Reasoning Agent",
});
