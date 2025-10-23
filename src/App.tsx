import { useState } from 'react'
import { useAuth } from './AuthContext'
import LoginScreen from './LoginScreen'
import { useFirestoreCollection } from './useFirestoreCollection'
import { useFirestoreDoc } from './useFirestoreDoc'

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
  'butter': 0.911,  // melted
  'honey': 1.42,
  'syrup': 1.37,
  // Dry ingredients
  'flour': 0.528,  // all-purpose flour, spooned and leveled
  'sugar': 0.845,  // granulated sugar
  'brown sugar': 0.845,
  'salt': 1.217,
  'baking powder': 0.9,
  'baking soda': 0.9,
  'cocoa': 0.54,
  'yeast': 0.64,
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
  savedAt: string
  totalCost?: number
  costPerUnit?: number
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
      return data
    } catch (e) {
      console.error('Error loading saved data:', e)
      // Fall through to return defaults
    }
  }
  return {
    recipeName: 'Sourdough Bread',
    ingredients: [
      { name: 'Whole Wheat Flour', quantity: 500, unit: 'g', packageSize: 2268, packageUnit: 'g', packagePrice: 10 },
      { name: 'Water', quantity: 350, unit: 'g', packageSize: 1000, packageUnit: 'g', packagePrice: 0 },
      { name: 'Salt', quantity: 10, unit: 'g', packageSize: 737, packageUnit: 'g', packagePrice: 2 },
    ],
    preheatTime: 15,
    bakeTime: 45,
    bakeTemp: 450,
    mixerTime: 10,
    laborTime: 30,
    laborRate: 20,
    packagingCost: 0.5,
    yieldQty: 2,
    yieldUnit: 'loaves',
    gasRate: 1.5,
    electricRate: 0.15,
  }
}

function App() {
  const { user, loading, signOut } = useAuth()
  const savedData = loadSavedData()

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

  // Show login screen if not authenticated
  if (!user) {
    return <LoginScreen />
  }

  // Recipe catalog - now synced with Firestore
  const { data: catalog, add: addRecipe, update: updateRecipe, remove: removeRecipe } = useFirestoreCollection<Recipe>('recipes')
  const [showCatalog, setShowCatalog] = useState(false)

  // Ingredient database - now synced with Firestore
  const { data: ingredientDB, add: addIngredientDB, update: updateIngredientDB, remove: removeIngredientDB } = useFirestoreCollection<IngredientDatabase>('ingredients')
  const [showIngredientDB, setShowIngredientDB] = useState(false)

  // Settings database - now synced with Firestore
  const { data: settings, update: updateSettingsDoc } = useFirestoreDoc<Settings>('settings/data', {
    laborRate: 20,
    gasRate: 1.5,
    electricRate: 0.15,
    packagingOptions: []
  })
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

  // Save recipe to catalog
  const saveRecipeToCatalog = async (totalCost: number, costPerUnit: number) => {
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
      savedAt: new Date().toISOString(),
      totalCost,
      costPerUnit
    }

    // Check if recipe with same name exists
    const existing = catalog.find(r => r.recipeName === recipeName)

    try {
      if (existing) {
        // Update existing recipe
        await updateRecipe(existing.id, recipeData)
        alert('✅ Recipe updated in catalog!')
      } else {
        // Add new recipe
        await addRecipe(recipeData)
        alert('✅ Recipe saved to catalog!')
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
    setShowCatalog(false)
    alert('✅ Recipe loaded!')
  }

  // Delete recipe from catalog
  const deleteRecipe = async (id: string) => {
    if (confirm('Are you sure you want to delete this recipe?')) {
      try {
        await removeRecipe(id)
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
      await addIngredientDB(newIngredient)
    } catch (error) {
      console.error('Error adding ingredient to database:', error)
      alert('❌ Failed to add ingredient. Please try again.')
    }
  }

  const updateIngredientInDB = async (id: string, field: keyof Omit<IngredientDatabase, 'id'>, value: string | number) => {
    try {
      await updateIngredientDB(id, { [field]: value })
    } catch (error) {
      console.error('Error updating ingredient:', error)
      alert('❌ Failed to update ingredient. Please try again.')
    }
  }

  const deleteIngredientFromDB = async (id: string) => {
    if (confirm('Are you sure you want to delete this ingredient from the database?')) {
      try {
        await removeIngredientDB(id)
        alert('✅ Ingredient deleted from database!')
      } catch (error) {
        console.error('Error deleting ingredient:', error)
        alert('❌ Failed to delete ingredient. Please try again.')
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
      await updateSettingsDoc({ [field]: value })
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

  // Total energy cost
  const totalEnergyCost = gasCost + mixerCost

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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">🍞 Baking Cost Calculator</h1>
            <p className="text-sm text-gray-600 mt-1">Welcome, {user.displayName || user.email}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={startNewRecipe}
              className="px-6 py-3 bg-orange-600 text-white font-semibold rounded-md hover:bg-orange-700 transition shadow-md"
            >
              ✨ New Recipe
            </button>
            <button
              onClick={() => saveRecipeToCatalog(grandTotal, costPerUnit)}
              className="px-6 py-3 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition shadow-md"
            >
              💾 Save Recipe
            </button>
            <button
              onClick={() => setShowCatalog(!showCatalog)}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition shadow-md"
            >
              📚 {showCatalog ? 'Hide' : 'Show'} Catalog ({catalog.length})
            </button>
            <button
              onClick={() => setShowIngredientDB(!showIngredientDB)}
              className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 transition shadow-md"
            >
              🗄️ {showIngredientDB ? 'Hide' : 'Show'} Ingredients DB ({ingredientDB.length})
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700 transition shadow-md"
            >
              ⚙️ {showSettings ? 'Hide' : 'Show'} Settings
            </button>
            <button
              onClick={signOut}
              className="px-6 py-3 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition shadow-md"
            >
              🚪 Logout
            </button>
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
                          <p>Total Cost: <span className="font-semibold text-green-700">${recipe.totalCost?.toFixed(2) || '0.00'}</span></p>
                          <p>Cost per {recipe.yieldUnit.toLowerCase().replace(/s$/, '')}: <span className="font-semibold text-blue-700">${recipe.costPerUnit?.toFixed(2) || '0.00'}</span></p>
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
                <div className="grid grid-cols-[1fr_6rem_5rem_6rem_3.25rem] gap-2 mb-2">
                  <div className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded-md border border-gray-300">Name</div>
                  <div className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded-md border border-gray-300">Pkg size</div>
                  <div className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded-md border border-gray-300">Pkg unit</div>
                  <div className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded-md border border-gray-300">Pkg price</div>
                  <div></div>
                </div>
                {ingredientDB.map((ing) => (
                  <div key={ing.id} className="grid grid-cols-[1fr_6rem_5rem_6rem_3.25rem] gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Flour"
                      value={ing.name}
                      onChange={(e) => updateIngredientInDB(ing.id, 'name', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="number"
                      placeholder="2268"
                      value={ing.packageSize === 0 ? '' : ing.packageSize}
                      onChange={(e) => updateIngredientInDB(ing.id, 'packageSize', e.target.value === '' ? 0 : Number(e.target.value))}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="text"
                      placeholder="g"
                      value={ing.packageUnit}
                      onChange={(e) => updateIngredientInDB(ing.id, 'packageUnit', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="10.00"
                      value={ing.packagePrice === 0 ? '' : ing.packagePrice}
                      onChange={(e) => updateIngredientInDB(ing.id, 'packagePrice', e.target.value === '' ? 0 : Number(e.target.value))}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={() => deleteIngredientFromDB(ing.id)}
                      className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
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

          {/* Column Labels - using grid for perfect alignment */}
          <div className="grid grid-cols-[1fr_6rem_5rem_6rem_5rem_6rem_3.25rem] gap-2 mb-2">
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
              <div key={idx} className="grid grid-cols-[1fr_6rem_5rem_6rem_5rem_6rem_3.25rem] gap-2 items-center">
                <div className="relative flex gap-1">
                  <input
                    type="text"
                    placeholder="Type or select from DB"
                    value={ing.name}
                    onChange={(e) => updateIngredient(idx, 'name', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    list={`ingredient-suggestions-${idx}`}
                  />
                  <datalist id={`ingredient-suggestions-${idx}`}>
                    {ingredientDB.map((dbIng) => (
                      <option key={dbIng.id} value={dbIng.name} />
                    ))}
                  </datalist>
                  {ingredientDB.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          const selected = ingredientDB.find(db => db.id === e.target.value)
                          if (selected) {
                            selectIngredientFromDB(idx, selected)
                          }
                        }
                        e.target.value = '' // Reset select
                      }}
                      className="px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                      defaultValue=""
                    >
                      <option value="">📋</option>
                      {ingredientDB.map((dbIng) => (
                        <option key={dbIng.id} value={dbIng.id}>
                          {dbIng.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
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
                >
                  ✕
                </button>
              </div>
            ))}
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
        <div className="bg-white rounded-lg shadow p-6 mb-6">
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
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">💰 Cost Breakdown</h2>

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
          <div className="mb-6">
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

          {/* Totals */}
          <div className="bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-400 rounded-lg p-6 mt-6">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xl font-bold text-gray-900">Grand Total</span>
              <span className="text-2xl font-bold text-green-700">${grandTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mb-3 text-sm">
              <span className="text-gray-700">Grand Total (without labor)</span>
              <span className="font-semibold text-green-600">${grandTotalWithoutLabor.toFixed(2)}</span>
            </div>
            <div className="border-t-2 border-green-300 pt-3 flex justify-between items-center mb-2">
              <span className="text-lg font-semibold text-gray-800">
                Cost per {yieldUnit.toLowerCase()}
              </span>
              <span className="text-3xl font-bold text-green-600">
                ${costPerUnit.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-700">Cost per {yieldUnit.toLowerCase()} (without labor)</span>
              <span className="font-semibold text-green-600">${costPerUnitWithoutLabor.toFixed(2)}</span>
            </div>
            <div className="text-center text-sm text-gray-600 mt-3">
              Based on {yieldQty} {yieldUnit.toLowerCase()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
