'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from './ui/button'
import { useRouter } from 'next/navigation';
import { PlaidLinkOnSuccess, PlaidLinkOptions, usePlaidLink } from 'react-plaid-link'
import { createLinkToken, exchangePublicToken } from '@/lib/actions/user.actions';

interface PlaidLinkProps {
    user: any;
    variant?: 'primary' | 'ghost';
}

const PlaidLink = ({ user, variant }: PlaidLinkProps) => {
    const router = useRouter();
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        const getLinkToken = async () => {
            const data = await createLinkToken(user);
            if (data?.linkToken) {
                setToken(data.linkToken);
            }
        }
        getLinkToken();
    }, [user]);

    const onSuccess = useCallback<PlaidLinkOnSuccess>(async (public_token: string) => {
        await exchangePublicToken({
            publicToken: public_token,
            user,
        });
        router.push('/');
    }, [user, router]);

    const config: PlaidLinkOptions = {
        token: token!,
        onSuccess
    };

    const { open, ready } = usePlaidLink(config);

    return (
        <>
            {variant === 'primary' ? (
                <Button 
                    className="plaidlink-primary" 
                    onClick={() => open()} 
                    disabled={!ready}
                >
                    Connect Bank
                </Button>
            ) : (
                <Button 
                    className="plaidlink-default" 
                    onClick={() => open()} 
                    disabled={!ready}
                >
                    Connect Bank
                </Button>
            )}
        </>
    )
}

export default PlaidLink;
