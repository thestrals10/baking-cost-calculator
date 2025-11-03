export interface Ingredient {
  name: string
  quantity: number
  unit: string
  packageSize: number
  packageUnit: string
  packagePrice: number
}

export interface Recipe {
  id: string
  recipeName: string
  ingredients: Ingredient[]
  preheatTime: number
  bakeTime: number
  bakeTemp: number
  mixerTime: number
  laborTime: number
  laborRate: number
  packagingCost: number
  yieldQty: number
  yieldUnit: string
  gasRate: number
  electricRate: number
  savedAt: string
  totalCost?: number
  costPerUnit?: number
}

export const defaultRecipes: Recipe[] = [
  {
    id: '1',
    recipeName: 'French-Style Country Bread',
    ingredients: [
      { name: 'Flour', quantity: 645, unit: 'g', packageSize: 1, packageUnit: 'kg', packagePrice: 2.5 },
      { name: 'Water', quantity: 454, unit: 'g', packageSize: 1, packageUnit: 'L', packagePrice: 0.1 },
      { name: 'Salt', quantity: 2, unit: 'tsp', packageSize: 1, packageUnit: 'kg', packagePrice: 1.0 },
      { name: 'Yeast', quantity: 1, unit: 'tsp', packageSize: 100, packageUnit: 'g', packagePrice: 2.0 },
      { name: 'Sugar', quantity: 14, unit: 'g', packageSize: 1, packageUnit: 'kg', packagePrice: 1.2 },
      { name: 'Nuts (walnuts)', quantity: 20, unit: 'g', packageSize: 1, packageUnit: 'kg', packagePrice: 15.0 },
      { name: 'Seeds (sesame/poppy)', quantity: 20, unit: 'g', packageSize: 1, packageUnit: 'kg', packagePrice: 12.0 }
    ],
    preheatTime: 30,
    bakeTime: 30,
    bakeTemp: 425,
    mixerTime: 15,
    laborTime: 30,
    laborRate: 20,
    packagingCost: 0.2,
    yieldQty: 1,
    yieldUnit: 'loaf',
    gasRate: 2.6,
    electricRate: 0.18,
    savedAt: new Date().toISOString(),
    totalCost: 13.48,
    costPerUnit: 13.48
  }
]
