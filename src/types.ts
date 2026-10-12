export type AppPage = 'home' | 'explore' | 'profile' | 'post' | 'dashboard' | 'how' | 'pro-signup' | 'settings'

export interface Portfolio {
  id: number
  title: string
  image: string
  description: string
}

export interface Testimonial {
  id: number
  author: string
  avatar: string
  text: string
  rating: number
  date: string
}

export interface Professional {
  id: number
  name: string
  profession: string
  category: string
  location: string
  province: string
  rating: number
  reviews: number
  score: number
  skills: string[]
  hourlyRate: number
  avatar: string
  available: boolean
  jobsCompleted: number
  bio: string
  verified: boolean
  portfolio: Portfolio[]
  testimonials: Testimonial[]
  responseTime: string
  /** Só existe quando o servidor devolveu o contacto (perfil próprio ou número público). */
  phone?: string
  whatsapp?: string
}

export interface Category {
  id: string
  name: string
  icon: string
  count: number
  color: string
}

export interface Job {
  id: number
  title: string
  description: string
  budget: string
  location: string
  category: string
  urgent: boolean
  postedAt: string
  proposals: number
}

export interface NavigateFn {
  (page: AppPage, proId?: number): void
}
