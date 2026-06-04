-- Increase default geo detection radius from 200m to 500m
alter table properties alter column geo_radius_meters set default 500;
update properties set geo_radius_meters = 500 where geo_radius_meters = 200;
