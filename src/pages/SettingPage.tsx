import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import SettingModal from '../components/SettingModal';

import { ArrowSmallLeftIcon, PlusIcon } from '@heroicons/react/24/solid';
import { useSelector } from 'react-redux';
import SettingCard from '../components/SettingCard';
import { RootState } from '../utils/store';

const GlobalSetting: React.FC = () => {
    return (
        <>
            <SettingCard shortcut="Mouse Wheel" leftHand='Pointing_Up' disable />
            <SettingCard shortcut="Mouse Cursor" rightHand='Pointing_Up' disable />
        </>

    );
}

const SettingPage: React.FC = () => {

    const { software } = useParams(); // 变量名必须和路由配置里一样

    const navigate = useNavigate();
    const [isModalVisible, setModalVisible] = useState(false);

    const UserSetting: React.FC = () => {
        const appsConfig = useSelector((state: RootState) => state.config.apps);
        const shortcutData = appsConfig[software!].shortcut;

        return (
            <>
                {Object.keys(shortcutData).map((shortcut, index) => (
                    <SettingCard
                        key={index}
                        shortcut={shortcut}
                        leftHand={shortcutData[shortcut][0]}
                        rightHand={shortcutData[shortcut][1]}
                    />
                ))}
            </>
        );
    }

    return (
        <>
            <div className='bg-gray-200 min-h-screen'>
                {/* 返回按钮 */}
                <button
                    onClick={() => navigate(-1)}
                    className="fixed top-4 left-4 rounded-full w-9 h-9 p-1 bg-gray-100 hover:bg-gray-300 shadow-md"
                >
                    <ArrowSmallLeftIcon />
                </button>

                {/* 软件名 */}
                <p className="text-3xl font-bold text-center text-teal-600 pt-5">
                    {software}
                </p>

                <div className="flex flex-wrap justify-start gap-8 max-w-6xl p-12 pt-6">
                    {software === 'Global' ?
                        <>
                            {/* 暂不开放修改权限 */}
                            <GlobalSetting />
                        </>
                        :
                        <>
                            <UserSetting />
                            {/* 添加新手势按钮 */}
                            <button
                                onClick={() => setModalVisible(true)}
                                className="fixed bottom-4 right-4 rounded-full w-12 h-12 p-2 bg-teal-400 text-white hover:bg-teal-600 shadow-md"
                            >
                                <PlusIcon />
                            </button>
                        </>
                    }
                </div>

                <SettingModal isVisible={isModalVisible} onClose={() => setModalVisible(false)} />
            </div>
        </>
    );
}

export default SettingPage;