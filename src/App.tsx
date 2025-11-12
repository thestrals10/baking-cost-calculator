import { useState } from 'react'
import { useAuth } from './AuthContext'
import LoginScreen from './LoginScreen'
import { useFirestoreCollection } from './useFirestoreCollection'
import { useFirestoreDoc } from './useFirestoreDoc'
import { defaultIngredients } from './defaultIngredients'
import { defaultRecipes } from './defaultRecipes'

// Unit conversion tables
const WEIGHT_CONVERSIONS: { [key: string]: number } = {
  // All to grams
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  pound: 453.592,
  pounds: 453.592,
  // Count conversions (eggs = 55g average)
  ct: 55,
  count: 55,
  piece: 55,
}

const VOLUME_CONVERSIONS: { [key: string]: number } = {
  // All to milliliters
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
  tsp: 4.92892,
  teaspoon: 4.92892,
  teaspoons: 4.92892,
  tbsp: 14.7868,
  tablespoon: 14.7868,
  tablespoons: 14.7868,
  'fl oz': 29.5735,
  cup: 236.588,
  cups: 236.588,
  pint: 473.176,
  pints: 473.176,
  quart: 946.353,
  quarts: 946.353,
  gal: 3785.41,
  gallon: 3785.41,
  gallons: 3785.41,
}

// Density conversions: grams per milliliter for common ingredients
// This allows volume <-> weight conversion
const INGREDIENT_DENSITIES: { [key: string]: number } = {
  // Liquids
  'water': 1.0,
  'milk': 1.03,
  'cream': 1.01,
  'oil': 0.92,
  'olive oil': 0.92,
  'vegetable oil': 0.92,
  'coconut oil': 0.92,
  'butter': 0.911,  // melted
  'honey': 1.42,
  'syrup': 1.37,
  'maple syrup': 1.33,
  'molasses': 1.42,
  'vanilla extract': 0.88,
  'almond extract': 0.88,
  'vanilla': 0.88,
  'buttermilk': 1.03,
  'yogurt': 1.04,
  'kefir': 1.04,
  'sour cream': 1.02,
  'cream cheese': 1.04,
  'sourdough starter': 1.0,
  'eggs': 1.03,
  'egg': 1.03,
  // Dry ingredients - Flours
  'flour': 0.528,  // all-purpose flour, spooned and leveled
  'all-purpose flour': 0.528,
  'bread flour': 0.54,
  'cake flour': 0.51,
  'whole wheat flour': 0.51,
  'rye flour': 0.53,
  // Dry ingredients - Sugars
  'sugar': 0.845,  // granulated sugar
  'granulated sugar': 0.845,
  'brown sugar': 0.845,
  'powdered sugar': 0.56,
  'confectioners sugar': 0.56,
  // Dry ingredients - Leavening & Spices
  'salt': 1.217,
  'baking powder': 0.9,
  'baking soda': 0.9,
  'yeast': 0.64,
  'cinnamon': 0.56,
  'spice': 0.56,
  'spices': 0.56,
  // Dry ingredients - Other
  'cocoa': 0.54,
  'cocoa powder': 0.54,
  'cornstarch': 0.68,
  'chocolate chips': 0.68,
  'chocolate': 0.68,
  'nuts': 0.53,
  'chopped nuts': 0.53,
  'raisins': 0.68,
  'dried fruit': 0.68,
  'coconut': 0.35,
  'shredded coconut': 0.35,
  'oats': 0.34,
  'rolled oats': 0.34,
}

// Helper to guess ingredient from name
function guessIngredientDensity(ingredientName: string): number | null {
  const name = ingredientName.toLowerCase()
  for (const [ingredient, density] of Object.entries(INGREDIENT_DENSITIES)) {
    if (name.includes(ingredient)) {
      return density
    }
  }
  return null
}

// Convert units function
function convertUnits(quantity: number, fromUnit: string, toUnit: string, ingredientName: string = ''): number {
  const from = fromUnit.toLowerCase().trim()
  const to = toUnit.toLowerCase().trim()

  // If same unit, no conversion needed
  if (from === to) return quantity

  // Try weight conversion
  if (WEIGHT_CONVERSIONS[from] && WEIGHT_CONVERSIONS[to]) {
    const grams = quantity * WEIGHT_CONVERSIONS[from]
    return grams / WEIGHT_CONVERSIONS[to]
  }

  // Try volume conversion
  if (VOLUME_CONVERSIONS[from] && VOLUME_CONVERSIONS[to]) {
    const ml = quantity * VOLUME_CONVERSIONS[from]
    return ml / VOLUME_CONVERSIONS[to]
  }

  // Try volume <-> weight conversion using density
  const isFromVolume = VOLUME_CONVERSIONS[from] !== undefined
  const isToVolume = VOLUME_CONVERSIONS[to] !== undefined
  const isFromWeight = WEIGHT_CONVERSIONS[from] !== undefined
  const isToWeight = WEIGHT_CONVERSIONS[to] !== undefined

  if ((isFromVolume && isToWeight) || (isFromWeight && isToVolume)) {
    const density = guessIngredientDensity(ingredientName)

    if (density) {
      if (isFromVolume && isToWeight) {
        // Volume -> Weight: convert to ml, then to grams using density, then to target weight unit
        const ml = quantity * VOLUME_CONVERSIONS[from]
        const grams = ml * density
        return grams / WEIGHT_CONVERSIONS[to]
      } else {
        // Weight -> Volume: convert to grams, then to ml using density, then to target volume unit
        const grams = quantity * WEIGHT_CONVERSIONS[from]
        const ml = grams / density
        return ml / VOLUME_CONVERSIONS[to]
      }
    } else {
      console.warn(`Cannot convert ${fromUnit} to ${toUnit} - unknown ingredient density for "${ingredientName}". Please use same unit type (volume or weight).`)
      return quantity
    }
  }

  // Cannot convert, return original
  console.warn(`Cannot convert ${fromUnit} to ${toUnit}`)
  return quantity
}

interface Ingredient {
  name: string
  quantity: number
  unit: string
  packageSize: number
  packageUnit: string
  packagePrice: number
}

interface StovetopProcess {
  id: string
  name: string
  stoveType: 'gas' | 'electric' | 'induction'
  burnerBTU?: number
  burnerWattage?: number
  powerLevel: number
  duration: number
}

interface Recipe {
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
  stovetopProcesses: StovetopProcess[]
  savedAt: string
  totalCost?: number
  costPerUnit?: number
  costPerUnitWithoutLabor?: number
}

interface IngredientDatabase {
  id: string
  name: string
  packageSize: number
  packageUnit: string
  packagePrice: number
}

interface PackagingOption {
  id: string
  name: string
  cost: number
}

interface Settings {
  laborRate: number
  gasRate: number
  electricRate: number
  packagingOptions: PackagingOption[]
  // Stovetop defaults
  stoveType: 'gas' | 'electric' | 'induction'
  gasBurnerBTU: number
  electricBurnerWattage: number
  inductionBurnerWattage: number
  gasBurnerEfficiency: number
  electricBurnerEfficiency: number
  inductionBurnerEfficiency: number
}

// Load saved data from localStorage or use defaults
const loadSavedData = () => {
  const saved = localStorage.getItem('bakingCostCalculator')
  if (saved) {
    try {
      const data = JSON.parse(saved)
      // Add packageUnit to old saved data that doesn't have it
      if (data.ingredients) {
        data.ingredients = data.ingredients.map((ing: any) => ({
          ...ing,
          packageUnit: ing.packageUnit || ing.unit || 'g'
        }))
      }
      // Add stovetopProcesses to old saved data that doesn't have it
      if (!data.stovetopProcesses) {
        data.stovetopProcesses = []
      }
      return data
    } catch (e) {
      console.error('Error loading saved data:', e)
      // Fall through to return defaults
    }
  }
  return {
    recipeName: '',
    ingredients: [],
    preheatTime: 0,
    bakeTime: 0,
    bakeTemp: 0,
    mixerTime: 0,
    laborTime: 0,
    laborRate: 20,
    packagingCost: 0,
    yieldQty: 1,
    yieldUnit: 'unit',
    gasRate: 2.6,
    electricRate: 0.18,
    stovetopProcesses: [],
  }
}

function App() {
  const { user, loading, signOut } = useAuth()
  const savedData = loadSavedData()
  const [guestMode, setGuestMode] = useState(false)

  // Determine if using Firestore (logged in) or localStorage (guest)
  const isUsingFirestore = !!user

  // Recipe catalog - Firestore for logged-in users, localStorage for guests
  const firestoreCatalog = useFirestoreCollection<Recipe>('recipes')
  const [localCatalog, setLocalCatalog] = useState<Recipe[]>(() => {
    const saved = localStorage.getItem('recipeCatalog')
    if (saved) {
      const parsed = JSON.parse(saved)
      return parsed.length > 0 ? parsed : defaultRecipes
    }
    return defaultRecipes
  })
  const catalog = isUsingFirestore ? firestoreCatalog.data : localCatalog
  const [showCatalog, setShowCatalog] = useState(false)

  // Ingredient database - Firestore for logged-in users, localStorage for guests
  const firestoreIngredientDB = useFirestoreCollection<IngredientDatabase>('ingredients')
  const [localIngredientDB, setLocalIngredientDB] = useState<IngredientDatabase[]>(() => {
    const saved = localStorage.getItem('ingredientDatabase')
    if (saved) {
      const parsed = JSON.parse(saved)
      return parsed.length > 0 ? parsed : defaultIngredients
    }
    return defaultIngredients
  })
  const ingredientDB = isUsingFirestore ? firestoreIngredientDB.data : localIngredientDB
  const [showIngredientDB, setShowIngredientDB] = useState(false)

  // Debug: Log ingredient IDs
  if (isUsingFirestore && ingredientDB.length > 0) {
    console.log('Current ingredients in DB:', ingredientDB.map(ing => ({ id: ing.id, name: ing.name })))
  }

  // Settings database - Firestore for logged-in users, localStorage for guests
  const firestoreSettings = useFirestoreDoc<Settings>('settings/data', {
    laborRate: 20,
    gasRate: 2.6,
    electricRate: 0.18,
    packagingOptions: [],
    stoveType: 'gas',
    gasBurnerBTU: 12000,
    electricBurnerWattage: 1500,
    inductionBurnerWattage: 1800,
    gasBurnerEfficiency: 0.4,
    electricBurnerEfficiency: 0.75,
    inductionBurnerEfficiency: 0.85
  })
  const [localSettings, setLocalSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('settings')
    if (saved) {
      const parsed = JSON.parse(saved)
      // Add defaults for missing stovetop fields
      return {
        laborRate: parsed.laborRate ?? 20,
        gasRate: parsed.gasRate ?? 2.6,
        electricRate: parsed.electricRate ?? 0.18,
        packagingOptions: parsed.packagingOptions ?? [
          { id: '1', name: 'Cake board and box', cost: 2.0 },
          { id: '2', name: 'Bread bag', cost: 0.2 }
        ],
        stoveType: parsed.stoveType ?? 'gas',
        gasBurnerBTU: parsed.gasBurnerBTU ?? 12000,
        electricBurnerWattage: parsed.electricBurnerWattage ?? 1500,
        inductionBurnerWattage: parsed.inductionBurnerWattage ?? 1800,
        gasBurnerEfficiency: parsed.gasBurnerEfficiency ?? 0.4,
        electricBurnerEfficiency: parsed.electricBurnerEfficiency ?? 0.75,
        inductionBurnerEfficiency: parsed.inductionBurnerEfficiency ?? 0.85
      }
    }
    return {
      laborRate: 20,
      gasRate: 2.6,
      electricRate: 0.18,
      packagingOptions: [
        { id: '1', name: 'Cake board and box', cost: 2.0 },
        { id: '2', name: 'Bread bag', cost: 0.2 }
      ],
      stoveType: 'gas',
      gasBurnerBTU: 12000,
      electricBurnerWattage: 1500,
      inductionBurnerWattage: 1800,
      gasBurnerEfficiency: 0.4,
      electricBurnerEfficiency: 0.75,
      inductionBurnerEfficiency: 0.85
    }
  })
  const settings = isUsingFirestore ? firestoreSettings.data : localSettings
  const [showSettings, setShowSettings] = useState(false)

  // Recipe info
  const [recipeName, setRecipeName] = useState(savedData.recipeName)

  // Ingredients
  const [ingredients, setIngredients] = useState<Ingredient[]>(savedData.ingredients)

  // Oven settings
  const [preheatTime, setPreheatTime] = useState(savedData.preheatTime)
  const [bakeTime, setBakeTime] = useState(savedData.bakeTime)
  const [bakeTemp, setBakeTemp] = useState(savedData.bakeTemp)

  // Mixer
  const [mixerTime, setMixerTime] = useState(savedData.mixerTime)

  // Labor
  const [laborTime, setLaborTime] = useState(savedData.laborTime)
  const [laborRate, setLaborRate] = useState(savedData.laborRate)

  // Packaging
  const [packagingCost, setPackagingCost] = useState(savedData.packagingCost)

  // Yield
  const [yieldQty, setYieldQty] = useState(savedData.yieldQty)
  const [yieldUnit, setYieldUnit] = useState(savedData.yieldUnit)

  // Energy rates
  const [gasRate, setGasRate] = useState(savedData.gasRate)
  const [electricRate, setElectricRate] = useState(savedData.electricRate)

  // Stovetop processes
  const [stovetopProcesses, setStovetopProcesses] = useState<StovetopProcess[]>(savedData.stovetopProcesses || [])

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🍞</div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Show login screen if not authenticated and not in guest mode
  if (!user && !guestMode) {
    return <LoginScreen onSkip={() => setGuestMode(true)} />
  }

  // Save recipe to catalog
  const saveRecipeToCatalog = async (totalCost: number, costPerUnit: number, costPerUnitWithoutLabor: number) => {
    if (!recipeName.trim()) {
      alert('⚠️ Please enter a recipe name before saving!')
      return
    }

    const recipeData = {
      recipeName,
      ingredients: [...ingredients],
      preheatTime,
      bakeTime,
      bakeTemp,
      mixerTime,
      laborTime,
      laborRate,
      packagingCost,
      yieldQty,
      yieldUnit,
      gasRate,
      electricRate,
      stovetopProcesses: [...stovetopProcesses],
      savedAt: new Date().toISOString(),
      totalCost,
      costPerUnit,
      costPerUnitWithoutLabor
    }

    // Check if recipe with same name exists
    const existing = catalog.find(r => r.recipeName === recipeName)

    try {
      if (isUsingFirestore) {
        // Firestore mode
        if (existing) {
          await firestoreCatalog.update(existing.id, recipeData)
          alert('✅ Recipe updated in catalog!')
        } else {
          await firestoreCatalog.add(recipeData)
          alert('✅ Recipe saved to catalog!')
        }
      } else {
        // localStorage mode
        const newRecipe = { ...recipeData, id: existing?.id || Date.now().toString() }
        let updatedCatalog
        if (existing) {
          updatedCatalog = catalog.map(r => r.id === existing.id ? newRecipe : r)
          alert('✅ Recipe updated in catalog!')
        } else {
          updatedCatalog = [...catalog, newRecipe]
          alert('✅ Recipe saved to catalog!')
        }
        setLocalCatalog(updatedCatalog as Recipe[])
        localStorage.setItem('recipeCatalog', JSON.stringify(updatedCatalog))
      }
    } catch (error) {
      console.error('Error saving recipe:', error)
      alert('❌ Failed to save recipe. Please try again.')
    }
  }

  // Load recipe from catalog
  const loadRecipe = (recipe: Recipe) => {
    setRecipeName(recipe.recipeName)
    setIngredients(recipe.ingredients)
    setPreheatTime(recipe.preheatTime)
    setBakeTime(recipe.bakeTime)
    setBakeTemp(recipe.bakeTemp)
    setMixerTime(recipe.mixerTime)
    setLaborTime(recipe.laborTime)
    setLaborRate(recipe.laborRate)
    setPackagingCost(recipe.packagingCost)
    setYieldQty(recipe.yieldQty)
    setYieldUnit(recipe.yieldUnit)
    setGasRate(recipe.gasRate)
    setElectricRate(recipe.electricRate)
    setStovetopProcesses(recipe.stovetopProcesses || [])
    setShowCatalog(false)
    alert('✅ Recipe loaded!')
  }

  // Delete recipe from catalog
  const deleteRecipe = async (id: string) => {
    if (confirm('Are you sure you want to delete this recipe?')) {
      try {
        if (isUsingFirestore) {
          await firestoreCatalog.remove(id)
        } else {
          const updatedCatalog = catalog.filter(r => r.id !== id)
          setLocalCatalog(updatedCatalog as Recipe[])
          localStorage.setItem('recipeCatalog', JSON.stringify(updatedCatalog))
        }
        alert('✅ Recipe deleted!')
      } catch (error) {
        console.error('Error deleting recipe:', error)
        alert('❌ Failed to delete recipe. Please try again.')
      }
    }
  }

  // Ingredient database management
  const addIngredientToDB = async () => {
    const newIngredient = {
      name: '',
      packageSize: 0,
      packageUnit: 'g',
      packagePrice: 0
    }
    try {
      if (isUsingFirestore) {
        await firestoreIngredientDB.add(newIngredient)
      } else {
        const withId = { ...newIngredient, id: Date.now().toString() }
        const updated = [...ingredientDB, withId]
        setLocalIngredientDB(updated as IngredientDatabase[])
        localStorage.setItem('ingredientDatabase', JSON.stringify(updated))
      }
    } catch (error) {
      console.error('Error adding ingredient to database:', error)
      alert('❌ Failed to add ingredient. Please try again.')
    }
  }

  const updateIngredientInDB = async (id: string, field: keyof Omit<IngredientDatabase, 'id'>, value: string | number) => {
    try {
      if (isUsingFirestore) {
        await firestoreIngredientDB.update(id, { [field]: value })
      } else {
        const updated = ingredientDB.map(ing =>
          ing.id === id ? { ...ing, [field]: value } : ing
        )
        setLocalIngredientDB(updated as IngredientDatabase[])
        localStorage.setItem('ingredientDatabase', JSON.stringify(updated))
      }
    } catch (error) {
      console.error('Error updating ingredient:', error)
      alert('❌ Failed to update ingredient. Please try again.')
    }
  }

  const deleteIngredientFromDB = async (id: string) => {
    if (confirm('Are you sure you want to delete this ingredient from the database?')) {
      console.log('Deleting ingredient with id:', id)
      console.log('Using Firestore:', isUsingFirestore)
      try {
        if (isUsingFirestore) {
          console.log('Attempting Firestore delete...')
          await firestoreIngredientDB.remove(id)
          console.log('Firestore delete successful')
        } else {
          console.log('Attempting localStorage delete...')
          const updated = ingredientDB.filter(ing => ing.id !== id)
          setLocalIngredientDB(updated as IngredientDatabase[])
          localStorage.setItem('ingredientDatabase', JSON.stringify(updated))
          console.log('localStorage delete successful')
        }
        alert('✅ Ingredient deleted from database!')
      } catch (error) {
        console.error('Error deleting ingredient:', error)
        alert('❌ Failed to delete ingredient. Error: ' + (error as Error).message)
      }
    }
  }

  // Select ingredient from database
  const selectIngredientFromDB = (index: number, dbIngredient: IngredientDatabase) => {
    const updated = [...ingredients]
    updated[index] = {
      ...updated[index],
      name: dbIngredient.name,
      packageSize: dbIngredient.packageSize,
      packageUnit: dbIngredient.packageUnit,
      packagePrice: dbIngredient.packagePrice,
      unit: 'g' // Always keep usage unit as 'g'
    }
    setIngredients(updated)
  }

  // Settings management
  const updateSettings = async (field: keyof Settings, value: any) => {
    try {
      if (isUsingFirestore) {
        await firestoreSettings.update({ [field]: value })
      } else {
        const updated = { ...settings, [field]: value }
        setLocalSettings(updated)
        localStorage.setItem('settings', JSON.stringify(updated))
      }
    } catch (error) {
      console.error('Error updating settings:', error)
      alert('❌ Failed to update settings. Please try again.')
    }
  }

  const addPackagingOption = async () => {
    const newOption: PackagingOption = {
      id: Date.now().toString(),
      name: '',
      cost: 0
    }
    const updated = [...settings.packagingOptions, newOption]
    await updateSettings('packagingOptions', updated)
  }

  const updatePackagingOption = async (id: string, field: keyof Omit<PackagingOption, 'id'>, value: string | number) => {
    const updated = settings.packagingOptions.map(opt =>
      opt.id === id ? { ...opt, [field]: value } : opt
    )
    await updateSettings('packagingOptions', updated)
  }

  const deletePackagingOption = async (id: string) => {
    if (confirm('Are you sure you want to delete this packaging option?')) {
      try {
        const updated = settings.packagingOptions.filter(opt => opt.id !== id)
        await updateSettings('packagingOptions', updated)
        alert('✅ Packaging option deleted!')
      } catch (error) {
        console.error('Error deleting packaging option:', error)
        alert('❌ Failed to delete packaging option. Please try again.')
      }
    }
  }

  // Start a new recipe (clear all fields, use settings defaults)
  const startNewRecipe = () => {
    if (confirm('Start a new recipe? This will clear all current inputs.')) {
      setRecipeName('')
      setIngredients([])
      setPreheatTime(0)
      setBakeTime(0)
      setBakeTemp(0)
      setMixerTime(0)
      setLaborTime(0)
      setLaborRate(settings.laborRate)
      setPackagingCost(0)
      setYieldQty(0)
      setYieldUnit('')
      setGasRate(settings.gasRate)
      setElectricRate(settings.electricRate)
      setStovetopProcesses([])
      alert('✅ Started new recipe!')
    }
  }

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', quantity: 0, unit: 'g', packageSize: 0, packageUnit: 'g', packagePrice: 0 }])
  }

  const updateIngredient = (index: number, field: keyof Ingredient, value: string | number) => {
    const updated = [...ingredients]
    updated[index] = { ...updated[index], [field]: value }
    setIngredients(updated)
  }

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  // Stovetop process management
  const addStovetopProcess = () => {
    const newProcess: StovetopProcess = {
      id: Date.now().toString(),
      name: '',
      stoveType: settings.stoveType,
      powerLevel: 70,
      duration: 0
    }
    setStovetopProcesses([...stovetopProcesses, newProcess])
  }

  const updateStovetopProcess = (index: number, field: keyof StovetopProcess, value: string | number | undefined) => {
    const updated = [...stovetopProcesses]
    updated[index] = { ...updated[index], [field]: value }
    setStovetopProcesses(updated)
  }

  const removeStovetopProcess = (index: number) => {
    setStovetopProcesses(stovetopProcesses.filter((_, i) => i !== index))
  }

  // CALCULATIONS

  // Calculate ingredient costs with unit conversion
  const ingredientCosts = ingredients.map(ing => {
    // Convert the used quantity to the same unit as package
    const convertedQuantity = convertUnits(ing.quantity, ing.unit, ing.packageUnit, ing.name)

    // Calculate price per package unit
    const pricePerPackageUnit = ing.packageSize > 0 ? ing.packagePrice / ing.packageSize : 0

    // Calculate cost for this ingredient
    const cost = convertedQuantity * pricePerPackageUnit

    // Debug logging for milk
    if (ing.name.toLowerCase().includes('milk')) {
      console.log('Milk calculation:', {
        used: ing.quantity,
        usedUnit: ing.unit,
        convertedQuantity,
        packageSize: ing.packageSize,
        packageUnit: ing.packageUnit,
        packagePrice: ing.packagePrice,
        pricePerPackageUnit,
        cost
      })
    }

    return {
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      convertedQuantity,
      packageUnit: ing.packageUnit,
      pricePerPackageUnit,
      cost
    }
  })
  const totalIngredientCost = ingredientCosts.reduce((sum, ing) => sum + ing.cost, 0)

  // Calculate gas oven cost
  // Formula: (preheat + bake time in hours) * BTU/hr / 100,000 * efficiency * gas rate
  const ovenBTU = 25000 // Average gas oven BTU/hr
  const ovenEfficiency = 0.65 // 65% efficiency
  const totalOvenTime = (preheatTime + bakeTime) / 60 // hours
  const thermsUsed = (ovenBTU * totalOvenTime) / 100000 / ovenEfficiency
  const gasCost = thermsUsed * gasRate

  // Calculate mixer electricity cost
  // Formula: (time in hours) * wattage / 1000 * electric rate
  const mixerWattage = 300 // Average stand mixer wattage
  const mixerHours = mixerTime / 60
  const mixerKWh = (mixerWattage * mixerHours) / 1000
  const mixerCost = mixerKWh * electricRate

  // Calculate stovetop energy costs
  const stovetopCosts = stovetopProcesses.map(process => {
    const durationHours = process.duration / 60
    const powerFraction = process.powerLevel / 100

    if (process.stoveType === 'gas') {
      const burnerBTU = process.burnerBTU ?? settings.gasBurnerBTU
      const effectiveBTU = burnerBTU * powerFraction
      const therms = (effectiveBTU * durationHours) / 100000 / settings.gasBurnerEfficiency
      const cost = therms * gasRate
      return {
        name: process.name,
        type: 'gas' as const,
        therms,
        kWh: 0,
        cost
      }
    } else {
      const wattage = process.burnerWattage ??
        (process.stoveType === 'induction' ?
          settings.inductionBurnerWattage :
          settings.electricBurnerWattage)
      const effectiveWattage = wattage * powerFraction
      const efficiency = process.stoveType === 'induction' ?
        settings.inductionBurnerEfficiency :
        settings.electricBurnerEfficiency
      const kWh = (effectiveWattage * durationHours) / 1000 / efficiency
      const cost = kWh * electricRate
      return {
        name: process.name,
        type: process.stoveType,
        therms: 0,
        kWh,
        cost
      }
    }
  })
  const totalStovetopCost = stovetopCosts.reduce((sum, s) => sum + s.cost, 0)

  // Total energy cost
  const totalEnergyCost = gasCost + mixerCost + totalStovetopCost

  // Calculate labor cost
  const laborHours = laborTime / 60
  const totalLaborCost = laborHours * laborRate

  // Calculate total packaging cost (per unit cost * yield quantity)
  const totalPackagingCost = packagingCost * yieldQty

  // Grand total
  const grandTotal = totalIngredientCost + totalEnergyCost + totalLaborCost + totalPackagingCost
  const grandTotalWithoutLabor = totalIngredientCost + totalEnergyCost + totalPackagingCost

  // Cost per unit
  const costPerUnit = yieldQty > 0 ? grandTotal / yieldQty : 0
  const costPerUnitWithoutLabor = yieldQty > 0 ? grandTotalWithoutLabor / yieldQty : 0

  // Export data function (for guest mode)
  const exportData = () => {
    const exportData = {
      recipes: localCatalog,
      ingredients: localIngredientDB,
      settings: localSettings,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }

    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `baking-data-export-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    alert('✅ Data exported successfully! Save this file to import later when you sign in.')
  }

  // Import data function (for signed-in mode)
  const importData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const importedData = JSON.parse(text)

      console.log('Imported data:', importedData)

      // Validate the imported data
      if (!importedData.recipes || !importedData.ingredients) {
        alert('❌ Invalid file format. Please select a valid export file.')
        return
      }

      let importedRecipes = 0
      let importedIngredients = 0

      // Import all recipes
      for (const recipe of importedData.recipes) {
        console.log('Importing recipe:', recipe.recipeName)
        // Remove id field before adding (Firestore will create a new one)
        const { id, ...recipeWithoutId } = recipe
        await firestoreCatalog.add(recipeWithoutId)
        importedRecipes++
      }

      // Import all ingredients
      for (const ingredient of importedData.ingredients) {
        console.log('Importing ingredient:', ingredient.name)
        // Remove id field before adding (Firestore will create a new one)
        const { id, ...ingredientWithoutId } = ingredient
        await firestoreIngredientDB.add(ingredientWithoutId)
        importedIngredients++
      }

      // Import settings if customized
      if (importedData.settings) {
        console.log('Importing settings')
        await firestoreSettings.update(importedData.settings)
      }

      alert(`✅ Import successful!\n${importedRecipes} recipes\n${importedIngredients} ingredients\nSynced to the cloud!`)

      // Reset file input
      event.target.value = ''
    } catch (error) {
      console.error('Import error:', error)
      alert('❌ Failed to import data. Please check the file and try again.\nError: ' + (error as Error).message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8 px-2 sm:px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold text-gray-900">🍞 Baking Cost Calculator</h1>
            {user ? (
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                ☁️ Synced • {user.displayName || user.email}
              </p>
            ) : (
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                💾 Local storage only • <button onClick={() => setGuestMode(false)} className="text-blue-600 hover:underline">Sign in to sync</button>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={startNewRecipe}
              className="px-3 sm:px-6 py-2 sm:py-3 bg-orange-600 text-white text-sm sm:text-base font-semibold rounded-md hover:bg-orange-700 transition shadow-md whitespace-nowrap"
            >
              ✨ New Recipe
            </button>
            <button
              onClick={() => saveRecipeToCatalog(grandTotal, costPerUnit, costPerUnitWithoutLabor)}
              className="px-3 sm:px-6 py-2 sm:py-3 bg-green-600 text-white text-sm sm:text-base font-semibold rounded-md hover:bg-green-700 transition shadow-md whitespace-nowrap"
            >
              💾 Save Recipe
            </button>
            <button
              onClick={() => setShowCatalog(!showCatalog)}
              className="px-3 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white text-sm sm:text-base font-semibold rounded-md hover:bg-blue-700 transition shadow-md whitespace-nowrap"
            >
              📚 {showCatalog ? 'Hide' : 'Show'} Catalog ({catalog.length})
            </button>
            <button
              onClick={() => setShowIngredientDB(!showIngredientDB)}
              className="px-3 sm:px-6 py-2 sm:py-3 bg-purple-600 text-white text-sm sm:text-base font-semibold rounded-md hover:bg-purple-700 transition shadow-md whitespace-nowrap"
            >
              🗄️ Ingredients DB ({ingredientDB.length})
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-3 sm:px-6 py-2 sm:py-3 bg-gray-600 text-white text-sm sm:text-base font-semibold rounded-md hover:bg-gray-700 transition shadow-md whitespace-nowrap"
            >
              ⚙️ Settings
            </button>
            {!user && (
              <button
                onClick={exportData}
                className="px-3 sm:px-6 py-2 sm:py-3 bg-indigo-600 text-white text-sm sm:text-base font-semibold rounded-md hover:bg-indigo-700 transition shadow-md whitespace-nowrap"
                title="Export all your recipes and data to a file"
              >
                📤 Export Data
              </button>
            )}
            {user && (
              <>
                <button
                  onClick={() => document.getElementById('import-file-input')?.click()}
                  className="px-3 sm:px-6 py-2 sm:py-3 bg-indigo-600 text-white text-sm sm:text-base font-semibold rounded-md hover:bg-indigo-700 transition shadow-md whitespace-nowrap"
                >
                  📥 Import Data
                </button>
                <input
                  id="import-file-input"
                  type="file"
                  accept=".json"
                  onChange={importData}
                  className="hidden"
                />
                <button
                  onClick={signOut}
                  className="px-3 sm:px-6 py-2 sm:py-3 bg-red-600 text-white text-sm sm:text-base font-semibold rounded-md hover:bg-red-700 transition shadow-md whitespace-nowrap"
                >
                  🚪 Logout
                </button>
              </>
            )}
          </div>
        </div>

        {/* Recipe Catalog */}
        {showCatalog && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Recipe Catalog</h2>
            {catalog.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No saved recipes yet. Save your first recipe to see it here!</p>
            ) : (
              <div className="space-y-3">
                {catalog.map((recipe) => (
                  <div
                    key={recipe.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-400 transition"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{recipe.recipeName}</h3>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>Yield: {recipe.yieldQty} {recipe.yieldUnit}</p>
                          <p>Cost per {recipe.yieldUnit.toLowerCase().replace(/s$/, '')} (with labor): <span className="font-semibold text-blue-700">${recipe.costPerUnit?.toFixed(2) || '0.00'}</span></p>
                          <p>Cost per {recipe.yieldUnit.toLowerCase().replace(/s$/, '')} (without labor): <span className="font-semibold text-purple-700">${(recipe.costPerUnitWithoutLabor ?? (recipe.totalCost && recipe.yieldQty ? ((recipe.totalCost - (recipe.laborTime / 60 * recipe.laborRate)) / recipe.yieldQty) : 0))?.toFixed(2) || '0.00'}</span></p>
                          <p className="text-xs text-gray-400">Saved: {new Date(recipe.savedAt).toLocaleDateString()} {new Date(recipe.savedAt).toLocaleTimeString()}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => loadRecipe(recipe)}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => deleteRecipe(recipe.id)}
                          className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ingredient Database */}
        {showIngredientDB && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-gray-900">Ingredient Database</h2>
              <button
                onClick={addIngredientToDB}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition"
              >
                + Add Ingredient to DB
              </button>
            </div>

            {ingredientDB.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No ingredients in database yet. Add your commonly used ingredients!</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2">
                  <div className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded-md border border-gray-300 min-w-0">Name</div>
                  <div className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded-md border border-gray-300 min-w-0">Pkg size</div>
                  <div className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded-md border border-gray-300 min-w-0">Pkg unit</div>
                  <div className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded-md border border-gray-300 min-w-0">Pkg price</div>
                  <div className="w-[3.25rem] flex-shrink-0"></div>
                </div>
                {ingredientDB.map((ing) => (
                  <div key={ing.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Flour"
                      value={ing.name}
                      onChange={(e) => updateIngredientInDB(ing.id, 'name', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      style={{ width: '100%', minWidth: 0 }}
                    />
                    <input
                      type="number"
                      placeholder="2268"
                      value={ing.packageSize === 0 ? '' : ing.packageSize}
                      onChange={(e) => updateIngredientInDB(ing.id, 'packageSize', e.target.value === '' ? 0 : Number(e.target.value))}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      style={{ width: '100%', minWidth: 0 }}
                    />
                    <input
                      type="text"
                      placeholder="g"
                      value={ing.packageUnit}
                      onChange={(e) => updateIngredientInDB(ing.id, 'packageUnit', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      style={{ width: '100%', minWidth: 0 }}
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="10.00"
                      value={ing.packagePrice === 0 ? '' : ing.packagePrice}
                      onChange={(e) => updateIngredientInDB(ing.id, 'packagePrice', e.target.value === '' ? 0 : Number(e.target.value))}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      style={{ width: '100%', minWidth: 0 }}
                    />
                    <button
                      onClick={() => deleteIngredientFromDB(ing.id)}
                      className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                      style={{ width: '3.25rem', flexShrink: 0 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings */}
        {showSettings && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Default Settings</h2>

            {/* Default Rates */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Default Rates</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Labor Rate ($/hr)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.laborRate === 0 ? '' : settings.laborRate}
                    onChange={(e) => updateSettings('laborRate', e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gas Rate ($/therm)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.gasRate === 0 ? '' : settings.gasRate}
                    onChange={(e) => updateSettings('gasRate', e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Electric Rate ($/kWh)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.electricRate === 0 ? '' : settings.electricRate}
                    onChange={(e) => updateSettings('electricRate', e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
              </div>
            </div>

            {/* Stovetop Equipment Defaults */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Stovetop Equipment Defaults</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Default Stove Type</label>
                  <select
                    value={settings.stoveType}
                    onChange={(e) => updateSettings('stoveType', e.target.value as 'gas' | 'electric' | 'induction')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    <option value="gas">Gas</option>
                    <option value="electric">Electric</option>
                    <option value="induction">Induction</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gas Burner (BTU/hr)</label>
                  <input
                    type="number"
                    step="100"
                    value={settings.gasBurnerBTU === 0 ? '' : settings.gasBurnerBTU}
                    onChange={(e) => updateSettings('gasBurnerBTU', e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gas Efficiency (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.gasBurnerEfficiency === 0 ? '' : (settings.gasBurnerEfficiency * 100)}
                    onChange={(e) => updateSettings('gasBurnerEfficiency', e.target.value === '' ? 0 : Number(e.target.value) / 100)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Electric Burner (W)</label>
                  <input
                    type="number"
                    step="100"
                    value={settings.electricBurnerWattage === 0 ? '' : settings.electricBurnerWattage}
                    onChange={(e) => updateSettings('electricBurnerWattage', e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Electric Efficiency (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.electricBurnerEfficiency === 0 ? '' : (settings.electricBurnerEfficiency * 100)}
                    onChange={(e) => updateSettings('electricBurnerEfficiency', e.target.value === '' ? 0 : Number(e.target.value) / 100)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
                <div></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Induction Burner (W)</label>
                  <input
                    type="number"
                    step="100"
                    value={settings.inductionBurnerWattage === 0 ? '' : settings.inductionBurnerWattage}
                    onChange={(e) => updateSettings('inductionBurnerWattage', e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Induction Efficiency (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.inductionBurnerEfficiency === 0 ? '' : (settings.inductionBurnerEfficiency * 100)}
                    onChange={(e) => updateSettings('inductionBurnerEfficiency', e.target.value === '' ? 0 : Number(e.target.value) / 100)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
                <div></div>
              </div>
            </div>

            {/* Packaging Options */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-800">Packaging Options</h3>
                <button
                  onClick={addPackagingOption}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
                >
                  + Add Packaging Option
                </button>
              </div>

              {settings.packagingOptions.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No packaging options yet. Add common packaging types!</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_8rem_3.25rem] gap-2 mb-2">
                    <div className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded-md border border-gray-300">Name</div>
                    <div className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded-md border border-gray-300">Cost ($/unit)</div>
                    <div></div>
                  </div>
                  {settings.packagingOptions.map((opt) => (
                    <div key={opt.id} className="grid grid-cols-[1fr_8rem_3.25rem] gap-2 items-center">
                      <input
                        type="text"
                        placeholder="e.g., Plastic bag, Box"
                        value={opt.name}
                        onChange={(e) => updatePackagingOption(opt.id, 'name', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.50"
                        value={opt.cost === 0 ? '' : opt.cost}
                        onChange={(e) => updatePackagingOption(opt.id, 'cost', e.target.value === '' ? 0 : Number(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                      />
                      <button
                        onClick={() => deletePackagingOption(opt.id)}
                        className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recipe Name */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recipe Name</h2>
          <input
            type="text"
            value={recipeName}
            onChange={(e) => setRecipeName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Ingredients */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Ingredients</h2>
            <button
              onClick={addIngredient}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              + Add Ingredient
            </button>
          </div>

          {/* Table wrapper with horizontal scroll */}
          <div className="overflow-x-auto">
            <div>
              {/* Column Labels - using grid for perfect alignment */}
              <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: 'minmax(140px, 1fr) 80px 80px 80px 80px 80px 30px' }}>
                <div className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded-md border border-gray-300">Name</div>
                <div className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded-md border border-gray-300">Used qty</div>
                <div className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded-md border border-gray-300">Unit</div>
                <div className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded-md border border-gray-300">Pkg size</div>
                <div className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded-md border border-gray-300">Pkg unit</div>
                <div className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded-md border border-gray-300">Pkg price</div>
                <div></div> {/* Spacer for delete button */}
              </div>

              <div className="space-y-3">
                {ingredients.map((ing, idx) => (
                  <div key={idx} className="grid gap-2 items-center" style={{ gridTemplateColumns: 'minmax(140px, 1fr) 80px 80px 80px 80px 80px 30px' }}>
                    <input
                      type="text"
                      placeholder="Type or select from DB"
                      value={ing.name}
                      onChange={(e) => {
                        updateIngredient(idx, 'name', e.target.value)
                        // Auto-fill package fields when selecting from datalist
                        const matchingIngredient = ingredientDB.find(
                          dbIng => dbIng.name === e.target.value
                        )
                        if (matchingIngredient) {
                          selectIngredientFromDB(idx, matchingIngredient)
                        }
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      list={`ingredient-suggestions-${idx}`}
                    />
                    <datalist id={`ingredient-suggestions-${idx}`}>
                      {ingredientDB.map((dbIng) => (
                        <option key={dbIng.id} value={dbIng.name} />
                      ))}
                    </datalist>
                    <input
                      type="number"
                      placeholder="500"
                      value={ing.quantity === 0 ? '' : ing.quantity}
                      onChange={(e) => updateIngredient(idx, 'quantity', e.target.value === '' ? 0 : Number(e.target.value))}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="g"
                      value={ing.unit}
                      onChange={(e) => updateIngredient(idx, 'unit', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      placeholder="2268"
                      value={ing.packageSize === 0 ? '' : ing.packageSize}
                      onChange={(e) => updateIngredient(idx, 'packageSize', e.target.value === '' ? 0 : Number(e.target.value))}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="g"
                      value={ing.packageUnit}
                      onChange={(e) => updateIngredient(idx, 'packageUnit', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="10.00"
                      value={ing.packagePrice === 0 ? '' : ing.packagePrice}
                      onChange={(e) => updateIngredient(idx, 'packagePrice', e.target.value === '' ? 0 : Number(e.target.value))}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => removeIngredient(idx)}
                      className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                      style={{ width: '30px' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Oven Settings */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Oven Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Preheat Time (min)</label>
              <input
                type="number"
                value={preheatTime === 0 ? '' : preheatTime}
                onChange={(e) => setPreheatTime(e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bake Time (min)</label>
              <input
                type="number"
                value={bakeTime === 0 ? '' : bakeTime}
                onChange={(e) => setBakeTime(e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Temperature (°F)</label>
              <input
                type="number"
                value={bakeTemp === 0 ? '' : bakeTemp}
                onChange={(e) => setBakeTemp(e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Stovetop Processes */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Stovetop Processes</h2>
            <button
              onClick={addStovetopProcess}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition"
            >
              + Add Process
            </button>
          </div>

          {stovetopProcesses.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No stovetop processes added yet. Add processes like "Make syrup" or "Boil water".</p>
          ) : (
            <div className="space-y-4">
              {stovetopProcesses.map((process, idx) => (
                <div key={process.id} className="border border-gray-300 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Process Name</label>
                      <input
                        type="text"
                        placeholder="e.g., Make simple syrup"
                        value={process.name}
                        onChange={(e) => updateStovetopProcess(idx, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Stove Type</label>
                      <select
                        value={process.stoveType}
                        onChange={(e) => updateStovetopProcess(idx, 'stoveType', e.target.value as 'gas' | 'electric' | 'induction')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="gas">Gas</option>
                        <option value="electric">Electric</option>
                        <option value="induction">Induction</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {process.stoveType === 'gas' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Burner BTU/hr (optional)</label>
                        <input
                          type="number"
                          placeholder={`Default: ${settings.gasBurnerBTU}`}
                          value={process.burnerBTU === undefined ? '' : process.burnerBTU}
                          onChange={(e) => updateStovetopProcess(idx, 'burnerBTU', e.target.value === '' ? undefined : Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    )}
                    {process.stoveType !== 'gas' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Burner Wattage (optional)</label>
                        <input
                          type="number"
                          placeholder={`Default: ${process.stoveType === 'induction' ? settings.inductionBurnerWattage : settings.electricBurnerWattage}`}
                          value={process.burnerWattage === undefined ? '' : process.burnerWattage}
                          onChange={(e) => updateStovetopProcess(idx, 'burnerWattage', e.target.value === '' ? undefined : Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Power Level (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="70"
                        value={process.powerLevel === 0 ? '' : process.powerLevel}
                        onChange={(e) => updateStovetopProcess(idx, 'powerLevel', e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Duration (min)</label>
                      <input
                        type="number"
                        placeholder="10"
                        value={process.duration === 0 ? '' : process.duration}
                        onChange={(e) => updateStovetopProcess(idx, 'duration', e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => removeStovetopProcess(idx)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                    >
                      Remove Process
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mixer & Labor */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Mixer & Labor</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mixer Time (min)</label>
              <input
                type="number"
                value={mixerTime === 0 ? '' : mixerTime}
                onChange={(e) => setMixerTime(e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Active Labor Time (min)</label>
              <input
                type="number"
                value={laborTime === 0 ? '' : laborTime}
                onChange={(e) => setLaborTime(e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Labor Rate ($/hr)</label>
              <input
                type="number"
                value={laborRate === 0 ? '' : laborRate}
                onChange={(e) => setLaborRate(e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Packaging & Yield */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Packaging & Yield</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Packaging Cost ($/unit)</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  step="0.01"
                  value={packagingCost === 0 ? '' : packagingCost}
                  onChange={(e) => setPackagingCost(e.target.value === '' ? 0 : Number(e.target.value))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {settings.packagingOptions.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        const selected = settings.packagingOptions.find(opt => opt.id === e.target.value)
                        if (selected) {
                          setPackagingCost(selected.cost)
                        }
                      }
                      e.target.value = '' // Reset select
                    }}
                    className="px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                    defaultValue=""
                  >
                    <option value="">📋</option>
                    {settings.packagingOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name} (${opt.cost.toFixed(2)})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Yield Quantity</label>
              <input
                type="number"
                value={yieldQty === 0 ? '' : yieldQty}
                onChange={(e) => setYieldQty(e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Yield Unit</label>
              <input
                type="text"
                value={yieldUnit}
                onChange={(e) => setYieldUnit(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Energy Rates */}
        <div className="bg-white rounded-lg shadow p-6 mb-16">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Energy Rates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Gas Rate ($/therm)</label>
              <input
                type="number"
                step="0.01"
                value={gasRate === 0 ? '' : gasRate}
                onChange={(e) => setGasRate(e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Electric Rate ($/kWh)</label>
              <input
                type="number"
                step="0.01"
                value={electricRate === 0 ? '' : electricRate}
                onChange={(e) => setElectricRate(e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <h2 className="text-2xl font-bold text-gray-900 mb-4">💰 Cost Breakdown</h2>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg px-6 pb-6 pt-6 shadow-lg">
          {/* Ingredients */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Ingredients</h3>
            <div className="bg-white rounded-lg p-4 space-y-2">
              {ingredientCosts.map((ing, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {ing.name} ({ing.quantity} {ing.unit})
                  </span>
                  <span className="font-medium text-gray-900">${ing.cost.toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                <span className="text-gray-800">Ingredients Total</span>
                <span className="text-blue-600">${totalIngredientCost.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Energy */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Energy</h3>
            <div className="bg-white rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">
                  Gas Oven ({thermsUsed.toFixed(3)} therms)
                </span>
                <span className="font-medium text-gray-900">${gasCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">
                  Mixer ({mixerKWh.toFixed(3)} kWh)
                </span>
                <span className="font-medium text-gray-900">${mixerCost.toFixed(2)}</span>
              </div>
              {stovetopCosts.map((stove, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    Stovetop - {stove.name} ({stove.type === 'gas' ? `${stove.therms.toFixed(3)} therms` : `${stove.kWh.toFixed(3)} kWh`})
                  </span>
                  <span className="font-medium text-gray-900">${stove.cost.toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                <span className="text-gray-800">Energy Total</span>
                <span className="text-blue-600">${totalEnergyCost.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Labor */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Labor</h3>
            <div className="bg-white rounded-lg p-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">
                  Active Time ({laborHours.toFixed(2)} hrs @ ${laborRate}/hr)
                </span>
                <span className="font-semibold text-blue-600">${totalLaborCost.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Packaging */}
          <div className="mb-0">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Packaging</h3>
            <div className="bg-white rounded-lg p-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">
                  Packaging Materials (${packagingCost.toFixed(2)}/unit × {yieldQty} units)
                </span>
                <span className="font-semibold text-blue-600">${totalPackagingCost.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* All-in Cost */}
          <div style={{marginTop: '48px'}}>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">All-in Cost</h3>

            <div className="flex justify-between items-center mb-3">
              <span className="font-bold text-gray-900">Total cost per yield (with labor)</span>
              <span className="font-bold text-gray-900">${grandTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="font-bold text-gray-900">Total cost per yield (without labor)</span>
              <span className="font-bold text-gray-900">${grandTotalWithoutLabor.toFixed(2)}</span>
            </div>

            <div style={{marginTop: '24px'}}>
              <div className="flex justify-between items-center mb-3">
                <span className="font-bold text-gray-900">Cost per {yieldUnit.toLowerCase()} (with labor)</span>
                <span className="font-bold text-gray-900">${costPerUnit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-900">Cost per {yieldUnit.toLowerCase()} (without labor)</span>
                <span className="font-bold text-gray-900">${costPerUnitWithoutLabor.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="text-center text-sm text-gray-600" style={{marginTop: '24px'}}>
            Based on 1 yield = {yieldQty} {yieldUnit.toLowerCase()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
