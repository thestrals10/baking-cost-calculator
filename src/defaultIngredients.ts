export interface IngredientDatabase {
  id: string
  name: string
  packageSize: number
  packageUnit: string
  packagePrice: number
}

export const defaultIngredients: IngredientDatabase[] = [
  { id: '1', name: 'Flour', packageSize: 1, packageUnit: 'kg', packagePrice: 2.5 },
  { id: '2', name: 'Kefir', packageSize: 1, packageUnit: 'L', packagePrice: 3.0 },
  { id: '3', name: 'Milk', packageSize: 1, packageUnit: 'L', packagePrice: 1.5 },
  { id: '4', name: 'Water', packageSize: 1, packageUnit: 'L', packagePrice: 0.1 },
  { id: '5', name: 'Eggs', packageSize: 12, packageUnit: 'eggs', packagePrice: 4.0 },
  { id: '6', name: 'Yeast', packageSize: 100, packageUnit: 'g', packagePrice: 2.0 },
  { id: '7', name: 'Salt', packageSize: 1, packageUnit: 'kg', packagePrice: 1.0 },
  { id: '8', name: 'Sugar', packageSize: 1, packageUnit: 'kg', packagePrice: 1.2 },
  { id: '9', name: 'Butter', packageSize: 1, packageUnit: 'kg', packagePrice: 8.0 },
  { id: '10', name: 'Seeds (sesame/poppy)', packageSize: 1, packageUnit: 'kg', packagePrice: 12.0 },
  { id: '11', name: 'Nuts (walnuts)', packageSize: 1, packageUnit: 'kg', packagePrice: 15.0 },
  { id: '12', name: 'Dried fruits (raisins)', packageSize: 1, packageUnit: 'kg', packagePrice: 10.0 },
  { id: '13', name: 'Chocolate chips', packageSize: 1, packageUnit: 'kg', packagePrice: 18.0 }
]
