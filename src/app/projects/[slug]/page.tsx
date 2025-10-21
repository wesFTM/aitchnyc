import projects from '@/data/projects';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export async function generateStaticParams() {
  return projects.map((project) => ({
    slug: project.slug,
  }));
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const project = projects.find((p) => p.slug === slug);

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white text-center p-10">
        <div>
          <h1 className="text-3xl font-bold">Page doesn’t exist</h1>
          <p className="mt-4">We couldn’t find a project with the slug “{slug}”.</p>
        </div>
      </div>
    );
  }

return (
  <div className="min-h-screen bg-black text-white">
    <Header />
    
    <main className="pt-40 px-6 flex flex-col items-center justify-start text-center">
      <div className="w-full max-w-3xl px-4">
        <h1 className="text-4xl font-bold">{project.title}</h1>
        <p className="mt-3 text-xl"><span className='font-bold'>My Role:</span> {project.role}</p>
        <p className="mt-3">{project.description}</p>
        <p className="mt-3"><span className='font-bold'>Tech:</span> {project.tech}</p>
      </div>
      <p className="mt-20 max-w-2xl text-4xl font-bold">See Campaign Assets Below:</p>
      
      <p className="mt-3 max-w-2xl">{project.mainDisc}</p>
      <video
        src={project.mainVideo}
        controls
        className="mt-8 w-full max-w-4xl rounded-lg shadow-lg"
      />
      
      <p className="mt-8 max-w-2xl text-2xl font-bold">Innovation Efforts</p>
      <p className="mt-3 max-w-2xl">{project.innovation}</p>
      <video
        src={project.innovationLink}
        controls
        className="mt-8 w-full max-w-xl rounded-lg shadow-lg"
      />
       <p className="mt-8 max-w-2xl text-2xl font-bold">Web Development</p>
      <p className="mt-3 max-w-xl">{project.websiteDesc}</p>
      <img src={project.websiteImage}
        className="mt-8 w-full max-w-4xl rounded-lg shadow-lg"
       />
    </main>
    <Footer />
  </div>
);

}
