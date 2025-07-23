// Job management for both seekers and employers
export class JobManager {
  constructor() {
    this.jobs = this.loadJobs()
    this.applications = this.loadApplications()
  }

  loadJobs() {
    const stored = localStorage.getItem("jobListings")
    return stored ? JSON.parse(stored) : this.getDefaultJobs()
  }

  saveJobs() {
    localStorage.setItem("jobListings", JSON.stringify(this.jobs))
  }

  loadApplications() {
    const stored = localStorage.getItem("jobApplications")
    return stored ? JSON.parse(stored) : []
  }

  saveApplications() {
    localStorage.setItem("jobApplications", JSON.stringify(this.applications))
  }

  getDefaultJobs() {
    return [
      {
        id: "1",
        title: "Senior Software Engineer",
        company: "TechCorp Inc.",
        location: "San Francisco, CA",
        type: "full-time",
        salary: "$120,000 - $150,000",
        description:
          "We are looking for a senior software engineer to join our growing team. You will be responsible for designing and implementing scalable web applications using modern technologies.",
        requirements:
          "Bachelor's degree in Computer Science, 5+ years of experience with JavaScript, React, Node.js, and cloud platforms.",
        postedDate: new Date().toISOString(),
        applications: [],
      },
      {
        id: "2",
        title: "Marketing Manager",
        company: "Growth Solutions",
        location: "New York, NY",
        type: "full-time",
        salary: "$80,000 - $100,000",
        description:
          "Join our marketing team to drive brand awareness and lead generation. You will develop and execute marketing campaigns across multiple channels.",
        requirements:
          "Bachelor's degree in Marketing or related field, 3+ years of digital marketing experience, proficiency in marketing automation tools.",
        postedDate: new Date().toISOString(),
        applications: [],
      },
      {
        id: "3",
        title: "UX Designer",
        company: "Design Studio",
        location: "Remote",
        type: "contract",
        salary: "$60 - $80 per hour",
        description:
          "We need a talented UX designer to help create intuitive and engaging user experiences for our client projects.",
        requirements:
          "Portfolio demonstrating UX design skills, proficiency in Figma/Sketch, understanding of user research methodologies.",
        postedDate: new Date().toISOString(),
        applications: [],
      },
    ]
  }

  postJob(jobData) {
    const newJob = {
      id: Date.now().toString(),
      ...jobData,
      postedDate: new Date().toISOString(),
      applications: [],
    }

    this.jobs.unshift(newJob)
    this.saveJobs()
    return newJob
  }

  searchJobs(query) {
    if (!query.trim()) {
      return this.jobs
    }

    const searchTerm = query.toLowerCase()
    return this.jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(searchTerm) ||
        job.company.toLowerCase().includes(searchTerm) ||
        job.location.toLowerCase().includes(searchTerm) ||
        job.description.toLowerCase().includes(searchTerm),
    )
  }

  applyForJob(jobId, applicationData) {
    const job = this.jobs.find((j) => j.id === jobId)
    if (!job) {
      throw new Error("Job not found")
    }

    const application = {
      id: Date.now().toString(),
      jobId: jobId,
      jobTitle: job.title,
      company: job.company,
      applicantName: applicationData.name || "Anonymous",
      appliedDate: new Date().toISOString(),
      status: "pending",
      ...applicationData,
    }

    job.applications.push(application)
    this.applications.push(application)

    this.saveJobs()
    this.saveApplications()

    return application
  }

  getJobApplications(jobId) {
    const job = this.jobs.find((j) => j.id === jobId)
    return job ? job.applications : []
  }

  getAllApplications() {
    return this.applications
  }

  updateApplicationStatus(applicationId, status) {
    // Update in applications array
    const application = this.applications.find((app) => app.id === applicationId)
    if (application) {
      application.status = status
    }

    // Update in job's applications array
    this.jobs.forEach((job) => {
      const jobApplication = job.applications.find((app) => app.id === applicationId)
      if (jobApplication) {
        jobApplication.status = status
      }
    })

    this.saveJobs()
    this.saveApplications()
  }

  renderJobCard(job, isEmployer = false) {
    const applicationCount = job.applications ? job.applications.length : 0

    return `
            <div class="job-card bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-xl font-semibold text-gray-800 mb-2">${job.title}</h3>
                        <p class="text-lg text-blue-600 font-medium">${job.company}</p>
                        <p class="text-gray-600 flex items-center mt-1">
                            <i class="fas fa-map-marker-alt mr-2"></i>${job.location}
                        </p>
                    </div>
                    <div class="text-right">
                        <span class="inline-block bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full mb-2">
                            ${job.type}
                        </span>
                        <p class="text-green-600 font-semibold">${job.salary}</p>
                    </div>
                </div>
                
                <p class="text-gray-700 mb-4 line-clamp-3">${job.description}</p>
                
                <div class="flex justify-between items-center">
                    <p class="text-sm text-gray-500">
                        Posted: ${new Date(job.postedDate).toLocaleDateString()}
                        ${isEmployer ? `| ${applicationCount} application${applicationCount !== 1 ? "s" : ""}` : ""}
                    </p>
                    <div class="space-x-2">
                        ${
                          isEmployer
                            ? `
                            <button onclick="viewJobApplications('${job.id}')" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors">
                                View Applications (${applicationCount})
                            </button>
                            <button onclick="editJob('${job.id}')" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors">
                                Edit
                            </button>
                        `
                            : `
                            <button onclick="viewJobDetails('${job.id}')" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors">
                                View Details
                            </button>
                            <button onclick="applyForJob('${job.id}')" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors">
                                Apply Now
                            </button>
                        `
                        }
                    </div>
                </div>
            </div>
        `
  }

  renderApplicationCard(application) {
    const statusColors = {
      pending: "bg-yellow-100 text-yellow-800",
      reviewed: "bg-blue-100 text-blue-800",
      interview: "bg-purple-100 text-purple-800",
      hired: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    }

    return `
            <div class="candidate-card bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800">${application.applicantName}</h3>
                        <p class="text-gray-600">${application.jobTitle} at ${application.company}</p>
                        <p class="text-sm text-gray-500 mt-1">Applied: ${new Date(application.appliedDate).toLocaleDateString()}</p>
                    </div>
                    <span class="px-3 py-1 rounded-full text-sm font-medium ${statusColors[application.status] || statusColors.pending}">
                        ${application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                    </span>
                </div>
                
                ${
                  application.coverLetter
                    ? `
                    <div class="mb-4">
                        <h4 class="font-medium text-gray-700 mb-2">Cover Letter:</h4>
                        <p class="text-gray-600 text-sm bg-gray-50 p-3 rounded">${application.coverLetter}</p>
                    </div>
                `
                    : ""
                }
                
                <div class="flex space-x-2">
                    <button onclick="updateApplicationStatus('${application.id}', 'reviewed')" class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors">
                        Mark Reviewed
                    </button>
                    <button onclick="updateApplicationStatus('${application.id}', 'interview')" class="bg-purple-500 text-white px-3 py-1 rounded text-sm hover:bg-purple-600 transition-colors">
                        Interview
                    </button>
                    <button onclick="updateApplicationStatus('${application.id}', 'hired')" class="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 transition-colors">
                        Hire
                    </button>
                    <button onclick="updateApplicationStatus('${application.id}', 'rejected')" class="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors">
                        Reject
                    </button>
                </div>
            </div>
        `
  }
}

// Global instance
const jobManager = new JobManager()
