import { customAlphabet } from 'nanoid'
import alphabet from '@/assets/data/alphabet'

export const nanoid = customAlphabet(alphabet, 16)
