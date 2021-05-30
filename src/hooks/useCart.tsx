import { createContext, ReactNode, useContext, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../services/api';
import { Product, Stock } from '../types';

interface CartProviderProps {
  children: ReactNode;
}

interface UpdateProductAmount {
  productId: number;
  amount: number;
}

interface CartContextData {
  cart: Product[];
  addProduct: (productId: number) => Promise<void>;
  removeProduct: (productId: number) => void;
  updateProductAmount: ({ productId, amount }: UpdateProductAmount) => void;
}

const CartContext = createContext<CartContextData>({} as CartContextData);

export function CartProvider({ children }: CartProviderProps): JSX.Element {
  const [cart, setCart] = useState<Product[]>(() => {
    const storagedCart = localStorage.getItem('@RocketShoes:cart')

    if (storagedCart) {
      return JSON.parse(storagedCart);
    }

    return [];
  });

  const getProductInfo = async (productId: number): Promise<Product> => {
    const response = await api.get(`/products/${productId}`)

    return response.data
  }

  const ensureHasStock = async ({id, amount}: Stock): Promise<boolean> => {
    const response = await api.get<Stock>(`/stock/${id}`)

    return response.data.amount >= amount
  }

  const updateCartAndStorage = (updatedCart: Product[]) => {
    localStorage.setItem(
      '@RocketShoes:cart', 
      JSON.stringify(updatedCart)
    )
    setCart(updatedCart)
    return
  }

  const removeProduct = (productId: number) => {
    try {
      const updatedCart: Product[] = cart.filter(p => p.id !== productId)

      if (cart.length === updatedCart.length) {
        throw new Error('Product does not exist')
      }

      return updateCartAndStorage(updatedCart)
    } catch {
      toast.error('Erro na remoção do produto');
      return
    }
  };

  const updateProductAmount = async ({
    productId,
    amount,
  }: UpdateProductAmount) => {
    try {
      if (amount <= 0) return

      const hasStock = await ensureHasStock({id: productId, amount})
      if(!hasStock) throw new Error('Not enough stock')

      const updatedCart: Product[] = cart.map(item => {
        if (item.id === productId) {
          return {...item, amount: amount}
        }
        return item
      })

      return updateCartAndStorage(updatedCart)
    } catch(err) {
      if (err.message === 'Not enough stock') {
        toast.error('Quantidade solicitada fora de estoque');
      }
      toast.error('Erro na alteração de quantidade do produto');
      return
    }
  };

  const addProduct = async (productId: number) => {
    try {
      const sameProductInCart = cart.find(prod => prod.id === productId)

      if (sameProductInCart) {
        await updateProductAmount({
          productId, 
          amount: sameProductInCart.amount + 1
        })
        return 
      }

      const hasStock = await ensureHasStock({id: productId, amount: 1})
      if(!hasStock) throw new Error('Not enough stock')

      const productData = await getProductInfo(productId)

      const updatedCart: Product[] = [...cart, {
        id: productId,
        amount: 1,
        image: productData.image,
        title: productData.title,
        price: productData.price
      }]

      return updateCartAndStorage(updatedCart)
    } catch(err) {
      if (err.message === 'Not enough stock') {
        toast.error('Quantidade solicitada fora de estoque');
      }
      toast.error('Erro na adição do produto');
      return
    }
  };

  return (
    <CartContext.Provider
      value={{ cart, addProduct, removeProduct, updateProductAmount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextData {
  const context = useContext(CartContext);

  return context;
}
