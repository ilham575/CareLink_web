import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import '../../../css/pages/default/home.css';
import HomeHeader from '../../components/HomeHeader';
import { formatTime } from '../../utils/time';
import Footer from '../../components/footer';
import AnimationWrapper from '../../components/AnimationWrapper'; // เพิ่มบรรทัดนี้

function PharmacyItem({ id, documentId, name_th, address, time_open, time_close, phone_store, photo_front, pharmacy_profiles }) {
	const navigate = useNavigate();

	const getImageUrl = (photo) => {
		if (!photo) return null;
		if (photo.formats?.thumbnail?.url) return photo.formats.thumbnail.url;
		if (photo.url) return photo.url;
		return null;
	};
	const imageUrl = getImageUrl(photo_front);

	const handleClick = () => {
		// use documentId as primary identifier for routes (fallback to id)
		navigate(`/drug_store_pharmacy/${id}`);
	};
	const handleDrugList = () => {
		navigate(`/drug_store_pharmacy/${documentId || id}/drugs`);
	};
	const handleFollowUp = () => {
		navigate(`/drug_store_pharmacy/${documentId || id}/followup-customers`);
	};

	return (
		<div className="pharmacy-item">
			<div className="pharmacy-image-placeholder" style={{ padding: 0, background: 'none' }}>
				{imageUrl ? (
					<img
						src={imageUrl.startsWith('/') ? `${process.env.REACT_APP_API_URL || 'http://localhost:1337'}${imageUrl}` : imageUrl}
						alt="รูปภาพร้านยา"
						style={{
							width: '100%',
							height: '100px',
							objectFit: 'cover',
							borderRadius: 5,
							display: 'block'
						}}
					/>
				) : (
					'รูปภาพร้านยา'
				)}
			</div>

			<div className="pharmacy-details">
				<p>ชื่อร้านยา: {name_th || 'ไม่พบข้อมูล'}</p>
				<p>ที่อยู่: {address || 'ไม่พบข้อมูล'}</p>
				<p>
					เวลาเปิดทำการ: {time_open || '-'} - {time_close || '-'} เบอร์โทรศัพท์: {phone_store || '-'}
				</p>
				
				{/* แสดงเวลาทำงานของเภสัชกร */}
				{pharmacy_profiles && pharmacy_profiles.length > 0 && (
					<div style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
						<strong>เวลาทำงานของเภสัชกร:</strong>
						{pharmacy_profiles.map((profile, index) => (
							<div key={profile.id || index} style={{ marginLeft: '8px', marginTop: '4px' }}>
								<span style={{ fontWeight: 'bold', color: '#4CAF50' }}>
									{profile.firstname} {profile.lastname}
								</span>
								{profile.working_time && profile.working_time.length > 0 ? (
									<ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
										{profile.working_time.map((time, timeIndex) => (
											<li key={timeIndex} style={{ fontSize: '12px' }}>
												{time.day}: {time.time_in || '-'} - {time.time_out || '-'}
											</li>
										))}
									</ul>
								) : (
									<span style={{ fontSize: '12px', color: '#999' }}> - ไม่ได้กำหนดเวลาทำงาน</span>
								)}
							</div>
						))}
					</div>
				)}
			</div>

			<div
				className="pharmacy-actions"
				style={{
					display: 'flex',
					gap: 8,
					marginTop: 8,
					flexWrap: 'wrap'
				}}
			>
				<button className="detail-button" onClick={handleClick}>
					กด<br />เพื่อดูรายละเอียด
				</button>
				<button className="detail-button" onClick={handleDrugList}>
					รายการยา
				</button>
				<button className="detail-button" onClick={handleFollowUp}>
					ลูกค้าที่ติดตามอาการ
				</button>
			</div>
		</div>
	);
}

function PharmacyHome() {
	const location = useLocation();
	const [pharmacies, setPharmacies] = useState([]);
	const [loading, setLoading] = useState(true);
	const [searchText, setSearchText] = useState('');
	const [userProfiles, setUserProfiles] = useState([]);
	const [profileLoading, setProfileLoading] = useState(true);
	const [userId, setUserId] = useState(null);
	const [refreshing, setRefreshing] = useState(false);

	const token = localStorage.getItem('jwt');

	// Function สำหรับ refresh ข้อมูลทั้งหมด
	const refreshData = async () => {
		setRefreshing(true);
		setLoading(true);
		setProfileLoading(true);
		setPharmacies([]);
		setUserProfiles([]);
		setUserId(null);
		
		// Clear any potential cache
		if ('caches' in window) {
			caches.keys().then(names => {
				names.forEach(name => {
					caches.delete(name);
				});
			});
		}
		
		// รอสักครู่เพื่อให้ state reset
		setTimeout(() => {
			setRefreshing(false);
		}, 1000);
	};

	// เพิ่ม useEffect สำหรับ refresh เมื่อกลับมาที่หน้า (ปิดการ auto refresh)
	// useEffect(() => {
	// 	const handleFocus = () => {
	// 		refreshData();
	// 	};
		
	// 	// เพิ่ม refresh เมื่อ component mount ใหม่
	// 	const handleVisibilityChange = () => {
	// 		if (!document.hidden) {
	// 			refreshData();
	// 		}
	// 	};

	// 	window.addEventListener('focus', handleFocus);
	// 	document.addEventListener('visibilitychange', handleVisibilityChange);
		
	// 	// Auto refresh ทุก 30 วินาที
	// 	const interval = setInterval(() => {
	// 		if (!document.hidden) {
	// 			refreshData();
	// 		}
	// 	}, 30000);

	// 	return () => {
	// 		window.removeEventListener('focus', handleFocus);
	// 		document.removeEventListener('visibilitychange', handleVisibilityChange);
	// 		clearInterval(interval);
	// 	};
	// }, []);

	// ขั้นตอนที่ 1: ดึง user.id จาก /api/users/me
	useEffect(() => {
		if (!token || refreshing) {
			setProfileLoading(false);
			setLoading(false);
			return;
		}

		const timestamp = Date.now();
		fetch(`http://localhost:1337/api/users/me?_=${timestamp}&nocache=${Math.random()}`, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json',
				'Cache-Control': 'no-cache, no-store, must-revalidate'
			}
		})
			.then(res => res.json())
			.then(userData => {
				setUserId(userData.id);
			})
			.catch(err => {
				console.error('❌ Error fetching user:', err);
				setProfileLoading(false);
				setLoading(false);
			});
	}, [token, refreshing]);

	// ขั้นตอนที่ 2: ดึง pharmacy profile โดยใช้ user.id
	useEffect(() => {
		if (!token || !userId || refreshing) {
			return;
		}

		const timestamp = Date.now();
		// include publicationState=preview when token exists so admin "Modified" records are returned
		const profilesUrl = `http://localhost:1337/api/pharmacy-profiles?filters[users_permissions_user][id][$eq]=${userId}&populate=profileimage&_=${timestamp}&nocache=${Math.random()}${token ? '&publicationState=preview' : ''}`;

		fetch(profilesUrl, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json',
				'Cache-Control': 'no-cache, no-store, must-revalidate'
			}
		})
			.then(res => res.json())
			.then(data => { 
				if (data.data && data.data.length > 0) {
					setUserProfiles(data.data);
				}
				setProfileLoading(false);
			})
			.catch(err => {
				console.error('❌ Error fetching user profile:', err);
				setProfileLoading(false);
			});
	}, [token, userId, refreshing]);

	// ขั้นตอนที่ 3: ดึงข้อมูลร้านยาและ filter ใน frontend
	useEffect(() => {
		if (profileLoading || !userProfiles.length || refreshing) {
			return;
		}

		const timestamp = Date.now();
		const storesUrl = `http://localhost:1337/api/drug-stores?populate=*&_=${timestamp}&nocache=${Math.random()}${token ? '&publicationState=preview' : ''}`;

		fetch(storesUrl, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json',
				'Cache-Control': 'no-cache, no-store, must-revalidate'
			}
		})
			.then(res => res.json())
			.then(data => {
				const allStores = Array.isArray(data.data) ? data.data : [];
				const myProfileDocIds = userProfiles.map(p => p.documentId);

				const myStores = allStores.filter(store => {
					const profiles = Array.isArray(store.pharmacy_profiles)
						? store.pharmacy_profiles
						: [];
					return profiles.some(profile => {
						if (typeof profile === 'object' && profile !== null) {
							return myProfileDocIds.includes(profile.documentId);
						} else {
							return myProfileDocIds.includes(profile);
						}
					});
				});
				setPharmacies(myStores);
				setLoading(false);
			})
			.catch((err) => {
				setPharmacies([]);
				setLoading(false);
			});
	}, [token, userProfiles, profileLoading, refreshing]);

	useEffect(() => {
		if (location.state?.showToast) {
			toast.success('เข้าสู่ระบบสำเร็จ!', { autoClose: 2000 });
		}
	}, [location.state]);

	const filteredPharmacies = pharmacies.filter(pharmacy =>
		pharmacy.name_th?.toLowerCase().includes(searchText.toLowerCase())
	);

	if (loading || profileLoading || refreshing) {
		return (
			<div className="app-container">
				<HomeHeader onSearch={setSearchText} isLoggedIn={true} />
				<main className="main-content">
					<AnimationWrapper>
						<div style={{ textAlign: 'center', marginTop: '40px' }}>
							{refreshing ? 'กำลังรีเฟรชข้อมูล...' : 'กำลังโหลดข้อมูล...'}
						</div>
					</AnimationWrapper>
				</main>
				<Footer />
			</div>
		);
	}

	if (!userProfiles.length) {
		return (
			<div className="app-container">
				<ToastContainer />
				<HomeHeader onSearch={setSearchText} isLoggedIn={true} />
				<main className="main-content">
					<AnimationWrapper>
						<div style={{ color: '#e57373', textAlign: 'center', marginTop: '40px' }}>
							ไม่พบข้อมูลโปรไฟล์เภสัชกร<br />
							กรุณาติดต่อผู้ดูแลระบบ
							<br /><br />
							<button 
								onClick={refreshData}
								style={{
									padding: '8px 16px',
									backgroundColor: '#4CAF50',
									color: 'white',
									border: 'none',
									borderRadius: '4px',
									cursor: 'pointer'
								}}
							>
								รีเฟรชข้อมูล
							</button>
						</div>
					</AnimationWrapper>
				</main>
				<Footer />
			</div>
		);
	}

	return (
		<div className="app-container">
			<ToastContainer />
			<HomeHeader onSearch={setSearchText} isLoggedIn={true} />
			<main className="main-content">
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
					<h2>ร้านยาของฉัน: </h2>
				</div>

				<AnimationWrapper>
					{filteredPharmacies.length === 0 ? (
						<div style={{ color: '#888', textAlign: 'center', marginTop: '40px' }}>
							{pharmacies.length === 0 
								? 'ยังไม่มีร้านยาที่คุณรับผิดชอบ' 
								: 'ไม่พบร้านยาที่ตรงกับการค้นหา'
							}
						</div>
					) : (
						filteredPharmacies.map(pharmacy => (
							<PharmacyItem
								key={pharmacy.documentId || pharmacy.id}
								id={pharmacy.id}
								documentId={pharmacy.documentId}
								name_th={pharmacy.name_th}
								address={pharmacy.address}
								time_open={formatTime(pharmacy.time_open)}
								time_close={formatTime(pharmacy.time_close)}
								phone_store={pharmacy.phone_store}
								photo_front={pharmacy.photo_front}
								pharmacy_profiles={pharmacy.pharmacy_profiles}
							/>
						))
					)}
				</AnimationWrapper>
			</main>
			<Footer />
		</div>
	);
}

export default PharmacyHome;
