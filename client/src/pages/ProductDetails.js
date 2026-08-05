import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiShoppingCart, FiHeart, FiShare2, FiTruck, FiShield, FiRefreshCw, FiCheck, FiChevronDown, FiChevronUp, FiStar, FiMinus, FiPlus, FiUser, FiPackage, FiCalendar, FiFileText, FiExternalLink } from 'react-icons/fi';
import { Carousel } from 'react-responsive-carousel';
import ReactStars from 'react-rating-stars-component';
import api, { products, orders } from '../services/api';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useUserBehavior } from '../contexts/UserBehaviorContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';
import toast from 'react-hot-toast';

const ProductDetails = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [otherBrandProducts, setOtherBrandProducts] = useState([]);
  const [brandCards, setBrandCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [userOrders, setUserOrders] = useState([]);
  const { addToCart } = useCart();
  const { isAuthenticated, user } = useAuth();
  const { addBrowsingHistory } = useUserBehavior();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await products.getById(id);
        const prod = res.data.data;
        setProduct(prod);
        
        // Track browsing history
        if (prod) {
          addBrowsingHistory(prod);
        }
        
        if (prod?.variants?.length > 0) {
          setSelectedVariant(prod.variants[0]);
        }
        try {
          const relatedRes = await api.get(`/products/${id}/related`);
          const data = relatedRes.data.data || relatedRes.data;
          setRelatedProducts((data.similar || data.related || []).slice(0, 8));
          setOtherBrandProducts((data.otherBrands || []).slice(0, 8));
          setBrandCards(data.brands || []);
        } catch {
          const relatedRes = await products.getAll({ category: prod?.category, limit: 8 });
          setRelatedProducts((relatedRes.data.data || []).filter(p => p._id !== prod?._id).slice(0, 8));
        }
        if (isAuthenticated) {
          try {
            const ordersRes = await orders.getAll({ status: 'delivered', limit: 100 });
            setUserOrders(ordersRes.data.data || []);
          } catch {}
        }
      } catch (err) {
        toast.error('Failed to load product');
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
    window.scrollTo(0, 0);
  }, [id, isAuthenticated]);

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(product, selectedVariant, quantity);
    toast.success('Added to cart!');
  };

  const handleBuyNow = () => {
    if (!product) return;
    addToCart(product, selectedVariant, quantity);
    toast.success('Added to cart!');
    window.location.href = '/checkout';
  };

  const canReview = useMemo(() => {
    if (!isAuthenticated || !product) return false;
    return userOrders.some(o =>
      o.items?.some(item => item.product === product._id || item.productId === product._id)
    );
  }, [isAuthenticated, product, userOrders]);

  const handleSubmitReview = async () => {
    if (reviewRating === 0) { toast.error('Please select a rating'); return; }
    if (!reviewText.trim()) { toast.error('Please write a review'); return; }
    const eligibleOrder = userOrders.find(o =>
      o.items?.some(item => item.product === product._id || item.productId === product._id)
    );
    if (!eligibleOrder) { toast.error('You can only review products you have purchased'); return; }
    setReviewLoading(true);
    try {
      await orders.review(eligibleOrder._id, { rating: reviewRating, review: reviewText, productId: product._id });
      toast.success('Review submitted!');
      setShowReviewForm(false);
      setReviewRating(0);
      setReviewText('');
      const res = await products.getById(id);
      setProduct(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setReviewLoading(false);
    }
  };

  const ratings = product?.ratings || [];
  const avgRating = product?.rating || 0;
  const totalRatings = product?.totalRatings || ratings.length;
  const totalReviews = product?.totalReviews || ratings.filter(r => r.review).length;

  const ratingDistribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0];
    ratings.forEach(r => { if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++; });
    return dist.reverse();
  }, [ratings]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main className="container page-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="spinner spinner-lg" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main className="container page-wrapper">
          <div className="empty-state">
            <h3>Product not found</h3>
            <p>The product you're looking for doesn't exist.</p>
            <Link to="/" className="btn btn-primary">Go Home</Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const discountPercent = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const images = product.images?.length > 0 ? product.images : ['/placeholder-glasses.png'];
  const seller = product.seller;
  const sellerSince = seller?.createdAt ? new Date(seller.createdAt).getFullYear() : null;
  const maskedGST = seller?.gstNumber ? `****${seller.gstNumber.slice(-4)}` : null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container" style={{ paddingTop: '16px', paddingBottom: '32px' }}>
          <nav style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '16px' }}>
            <Link to="/" style={{ color: 'var(--primary)' }}>Home</Link>
            {' / '}
            <Link to={`/category/${product.category}`} style={{ color: 'var(--primary)' }}>{product.category}</Link>
            {' / '}
            <span>{product.brand}</span>
            {' / '}
            <span style={{ color: 'var(--text-primary)' }}>{product.name}</span>
          </nav>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }} className="product-detail-grid">
            <div className="card" style={{ padding: '16px' }}>
              <Carousel showThumbs={false} autoPlay infiniteLoop showStatus={false}>
                {images.map((img, idx) => (
                  <div key={idx} style={{ background: '#fafafa', borderRadius: '8px', overflow: 'hidden' }}>
                    <img src={img} alt={`${product.name} - ${idx + 1}`} style={{ width: '100%', height: '400px', objectFit: 'contain' }} />
                  </div>
                ))}
              </Carousel>
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => toast.success('Added to wishlist!')}>
                  <FiHeart /> Wishlist
                </button>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied!'); }}>
                  <FiShare2 /> Share
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="card" style={{ padding: '20px' }}>
                <span className="badge badge-success" style={{ marginBottom: '8px' }}>{product.brand}</span>
                <h1 style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>{product.name}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  {avgRating > 0 && (
                    <>
                      <span className="rating">{avgRating.toFixed(1)} <FiStar size={10} /></span>
                      <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>({totalRatings} ratings, {totalReviews} reviews)</span>
                    </>
                  )}
                  {product.soldCount > 0 && (
                    <span style={{ fontSize: '13px', color: 'var(--text-light)', marginLeft: '8px' }}>{product.soldCount} sold</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>₹{product.price}</span>
                  {product.originalPrice && (
                    <span className="price-original" style={{ fontSize: '16px' }}>₹{product.originalPrice}</span>
                  )}
                  {discountPercent > 0 && (
                    <span className="price-discount" style={{ fontSize: '15px' }}>{discountPercent}% off</span>
                  )}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--success)', fontWeight: 500 }}>Inclusive of all taxes</p>
              </div>

              {seller && (
                <div className="card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FiPackage size={16} /> Seller Info
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <p style={{ fontSize: '11px', color: 'var(--text-light)', marginBottom: '2px', textTransform: 'uppercase' }}>Seller ID</p>
                      <p style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'monospace' }}>{seller.sellerId || 'N/A'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: 'var(--text-light)', marginBottom: '2px', textTransform: 'uppercase' }}>Store Name</p>
                      <p style={{ fontSize: '13px', fontWeight: 500 }}>{seller.storeName || 'N/A'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: 'var(--text-light)', marginBottom: '2px', textTransform: 'uppercase' }}>Rating</p>
                      <p style={{ fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FiStar size={12} style={{ color: '#f5a623' }} /> {seller.rating?.toFixed(1) || 'New'}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: 'var(--text-light)', marginBottom: '2px', textTransform: 'uppercase' }}>Since</p>
                      <p style={{ fontSize: '13px', fontWeight: 500 }}>{sellerSince || 'N/A'}</p>
                    </div>
                    {maskedGST && (
                      <div>
                        <p style={{ fontSize: '11px', color: 'var(--text-light)', marginBottom: '2px', textTransform: 'uppercase' }}>GST Number</p>
                        <p style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'monospace' }}>{maskedGST}</p>
                      </div>
                    )}
                  </div>
                  {seller.sellerId && (
                    <Link to={`/seller/${seller.sellerId}/products`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--primary)', fontWeight: 500, marginTop: '12px', textDecoration: 'none' }}>
                      View all products <FiExternalLink size={12} />
                    </Link>
                  )}
                </div>
              )}

              {product.variants?.length > 0 && (
                <div className="card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Select Variant</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {product.variants.map((variant, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedVariant(variant)}
                        style={{
                          padding: '8px 16px',
                          border: `2px solid ${selectedVariant === variant ? 'var(--primary)' : 'var(--border)'}`,
                          borderRadius: '4px',
                          background: selectedVariant === variant ? 'var(--primary-light)' : '#fff',
                          color: selectedVariant === variant ? 'var(--primary)' : 'var(--text-primary)',
                          fontWeight: 500,
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        {variant.label || `Power: ${variant.power || 'N/A'}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Quantity</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <FiMinus size={14} />
                  </button>
                  <span style={{ fontSize: '16px', fontWeight: 600, minWidth: '24px', textAlign: 'center' }}>{quantity}</span>
                  <button onClick={() => setQuantity(Math.min(10, quantity + 1))} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <FiPlus size={14} />
                  </button>
                </div>
              </div>

              <div className="card" style={{ padding: '20px', display: 'flex', gap: '12px' }}>
                <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={handleAddToCart}>
                  <FiShoppingCart /> Add to Cart
                </button>
                <button className="btn btn-secondary btn-lg" style={{ flex: 1 }} onClick={handleBuyNow}>
                  Buy Now
                </button>
              </div>

              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <FiTruck size={20} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Free Delivery</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <FiShield size={20} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>100% Genuine</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <FiRefreshCw size={20} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>7-Day Return</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              {['description', 'specifications', 'reviews'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '16px 24px',
                    fontSize: '14px',
                    fontWeight: activeTab === tab ? 600 : 400,
                    color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
                    borderBottom: activeTab === tab ? '3px solid var(--primary)' : '3px solid transparent',
                    textTransform: 'capitalize',
                    cursor: 'pointer',
                    background: 'none',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div style={{ padding: '24px' }}>
              {activeTab === 'description' && (
                <div>
                  <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>{product.description || 'No description available.'}</p>
                  {product.features?.length > 0 && (
                    <ul style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {product.features.map((feature, idx) => (
                        <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                          <FiCheck size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {activeTab === 'specifications' && (
                <div>
                  {product.specifications ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {Object.entries(product.specifications).map(([key, value]) => (
                          <tr key={key} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', width: '30%', background: '#fafafa' }}>{key}</td>
                            <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-primary)' }}>{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ fontSize: '14px', color: 'var(--text-light)' }}>No specifications available.</p>
                  )}
                </div>
              )}

              {activeTab === 'reviews' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '32px', marginBottom: '24px', alignItems: 'start' }} className="ratings-summary-grid">
                    <div style={{ textAlign: 'center', padding: '20px', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
                      <p style={{ fontSize: '40px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{avgRating.toFixed(1)}</p>
                      <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <FiStar key={i} size={16} style={{ color: i < Math.round(avgRating) ? '#f5a623' : '#ddd' }} />
                        ))}
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-light)' }}>{totalRatings} ratings</p>
                      <p style={{ fontSize: '13px', color: 'var(--text-light)' }}>{totalReviews} reviews</p>
                    </div>
                    <div>
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = ratingDistribution[5 - star];
                        const pct = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
                        return (
                          <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 500, width: '16px', textAlign: 'right' }}>{star}</span>
                            <FiStar size={12} style={{ color: '#f5a623' }} />
                            <div style={{ flex: 1, height: '8px', background: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: star >= 4 ? '#4caf50' : star === 3 ? '#ffc107' : '#f44336', borderRadius: '4px', transition: 'width 0.3s' }} />
                            </div>
                            <span style={{ fontSize: '12px', color: 'var(--text-light)', width: '32px', textAlign: 'right' }}>{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {isAuthenticated && canReview && !showReviewForm && (
                    <button onClick={() => setShowReviewForm(true)} className="btn btn-outline" style={{ marginBottom: '20px' }}>
                      <FiStar size={14} /> Rate this Product
                    </button>
                  )}

                  {showReviewForm && (
                    <div style={{ background: 'var(--bg-primary)', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                      <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Write a Review</h4>
                      <div style={{ marginBottom: '12px' }}>
                        <p style={{ fontSize: '13px', marginBottom: '6px' }}>Your Rating</p>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => setReviewRating(star)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                            >
                              <FiStar size={24} style={{ color: star <= reviewRating ? '#f5a623' : '#ddd', fill: star <= reviewRating ? '#f5a623' : 'none' }} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <p style={{ fontSize: '13px', marginBottom: '6px' }}>Your Review</p>
                        <textarea
                          className="input"
                          rows={3}
                          placeholder="Share your experience with this product..."
                          value={reviewText}
                          onChange={(e) => setReviewText(e.target.value)}
                          style={{ width: '100%', resize: 'vertical' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={handleSubmitReview} className="btn btn-primary" disabled={reviewLoading}>
                          {reviewLoading ? 'Submitting...' : 'Submit Review'}
                        </button>
                        <button onClick={() => { setShowReviewForm(false); setReviewRating(0); setReviewText(''); }} className="btn btn-outline">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {ratings.length > 0 ? (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {(showAllReviews ? ratings : ratings.slice(0, 5)).map((review, idx) => (
                          <div key={idx} style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600 }}>
                                {review.user?.name?.charAt(0)?.toUpperCase() || review.user?.avatar || <FiUser size={14} />}
                              </div>
                              <div>
                                <p style={{ fontSize: '14px', fontWeight: 500 }}>{review.user?.name || 'Verified Buyer'}</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <div style={{ display: 'flex', gap: '2px' }}>
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <FiStar key={i} size={10} style={{ color: i < review.rating ? '#f5a623' : '#ddd' }} />
                                    ))}
                                  </div>
                                  <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>{new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                </div>
                              </div>
                            </div>
                            {review.review && (
                              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginLeft: '42px' }}>{review.review}</p>
                            )}
                          </div>
                        ))}
                      </div>
                      {ratings.length > 5 && (
                        <button onClick={() => setShowAllReviews(!showAllReviews)} style={{ marginTop: '16px', color: 'var(--primary)', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', background: 'none' }}>
                          {showAllReviews ? 'Show Less' : `View All ${ratings.length} Reviews`}
                          {showAllReviews ? <FiChevronUp /> : <FiChevronDown />}
                        </button>
                      )}
                    </>
                  ) : (
                    <p style={{ fontSize: '14px', color: 'var(--text-light)' }}>No reviews yet. Be the first to review!</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {relatedProducts.length > 0 && (
            <section style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Similar Products</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                {relatedProducts.filter((p) => p._id !== product._id).slice(0, 5).map((p) => (
                  <ProductCard key={p._id} product={p} />
                ))}
              </div>
            </section>
          )}

          {otherBrandProducts.length > 0 && (
            <section style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Browse from Other Brands</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                {otherBrandProducts.slice(0, 5).map((p) => (
                  <ProductCard key={p._id} product={p} />
                ))}
              </div>
            </section>
          )}

          {brandCards.length > 0 && (
            <section style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Browse by Brand</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                {brandCards.slice(0, 8).map((brand, idx) => (
                  <Link
                    key={idx}
                    to={`/brands/${brand.name || brand}`}
                    className="card"
                    style={{ padding: '20px', textAlign: 'center', textDecoration: 'none', transition: 'box-shadow 0.2s', cursor: 'pointer' }}
                  >
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, margin: '0 auto 8px' }}>
                      {(typeof brand === 'string' ? brand : brand.name).charAt(0).toUpperCase()}
                    </div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{typeof brand === 'string' ? brand : brand.name}</p>
                    {brand.count !== undefined && (
                      <p style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '2px' }}>{brand.count} products</p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
      <style>{`
        @media (max-width: 768px) {
          .product-detail-grid {
            grid-template-columns: 1fr !important;
          }
          .ratings-summary-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ProductDetails;
